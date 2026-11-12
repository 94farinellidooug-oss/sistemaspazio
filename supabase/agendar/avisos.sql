-- MUSUBI · Agenda o envio diário dos e-mails de aviso (função cobranca, ?avisos=1), todo dia às 9h de Brasília:
--   · 7 dias antes de cada cobrança no cartão (Mercado Pago);
--   · 30 dias antes do fim do ciclo do anual com pagamento mensal (renova sozinho).
-- Antes: Resend configurado e os secrets RESEND_CHAVE, AVISO_REMETENTE e AVISOS_SEGREDO criados na função.
--
-- COMO RODAR (SQL Editor do Supabase), uma vez só:
--   1. Troque COLE_AQUI_A_FRASE_DO_AVISOS_SEGREDO pela mesma frase que você pôs no secret AVISOS_SEGREDO.
--   2. Rode tudo. Este arquivo NÃO volta para o GitHub com a frase: não salve a versão com a frase no repositório.
-- Para trocar a frase depois: select vault.update_secret((select id from vault.secrets where name = 'avisos_segredo'), 'NOVA FRASE');

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'avisos_segredo') then
    perform vault.create_secret('COLE_AQUI_A_FRASE_DO_AVISOS_SEGREDO', 'avisos_segredo', 'Frase do agendador dos avisos do MUSUBI');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'musubi-avisos';
select cron.schedule('musubi-avisos', '0 12 * * *', $job$
  select net.http_post(
    url := 'https://lmucimqjrzjewfyhcfoh.supabase.co/functions/v1/cobranca?avisos=1',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-avisos', (select decrypted_secret from vault.decrypted_secrets where name = 'avisos_segredo')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- Conferir: select * from cron.job where jobname = 'musubi-avisos';
-- Últimas execuções: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Resposta da função: select status_code, content from net._http_response order by created desc limit 5;
