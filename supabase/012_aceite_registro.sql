-- MUSUBI · registro do aceite do contrato mais completo (revisão jurídica de 11/11/2026).
-- Além da conta, do e-mail, da data, da hora e da versão do contrato, o aceite passa a guardar o endereço de
-- internet (IP) e o navegador de quem aceitou, o que reforça a prova da contratação eletrônica.
-- Rode no SQL Editor do Supabase depois do 008_contrato.sql. Pode rodar de novo sem problema.

alter table public.aceites add column if not exists ip text not null default '';
alter table public.aceites add column if not exists agente text not null default '';
