// MUSUBI · página do paciente para a consulta online (link recebido pelo WhatsApp: consulta/?c=<código>).
// Mostra a clínica e o horário, o termo de teleconsulta e, depois do aceite, abre a chamada de vídeo (Daily)
// em tela cheia. O aceite é registrado pelo servidor (função teleconsulta). Sem login e sem instalar nada.
(function(){
  var URL_FUNCAO = 'https://lmucimqjrzjewfyhcfoh.supabase.co/functions/v1/teleconsulta';
  var CHAVE = 'sb_publishable_kRmZNwp0_Xq4jPPMgTzKKA_SyLsreZS';
  var id = new URLSearchParams(location.search).get('c') || '', tela = document.getElementById('tela'), dados = null, espera = null;
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  var quando = function(iso){ var d = new Date(iso); return d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); };
  var cartao = function(h){ tela.innerHTML = '<div class="cartao">' + h + '</div>'; };
  function pedir(aceito){
    return fetch(URL_FUNCAO, { method:'POST', headers:{ 'Content-Type':'application/json', apikey:CHAVE }, body:JSON.stringify({ acao:'paciente', id:id, aceito:aceito === true }) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j.status = r.status; return j; }); });
  }
  function mostrar(j){
    dados = j; clearTimeout(espera);
    var ola = j.primeiro ? 'Olá, ' + esc(j.primeiro) + '!' : 'Olá!';
    var cab = '<h1>' + ola + '</h1><p class="suave">Consulta online' + (j.clinica ? ' com <b>' + esc(j.clinica) + '</b>' : '') + '</p>' + (j.inicio ? '<span class="quando">' + esc(quando(j.inicio)) + '</span>' : '');
    if (j.erro || !j.situacao) return cartao('<h1>Não foi possível abrir</h1><p class="erro">' + esc(j.msg || 'Confira o link que você recebeu.') + '</p>');
    if (j.situacao === 'cancelada') return cartao(cab + '<p class="erro">Este horário foi desmarcado. Fale com a clínica para marcar um novo.</p>');
    if (j.situacao === 'encerrada') return cartao(cab + '<p class="erro">O horário desta consulta já passou. Se precisar, fale com a clínica.</p>');
    if (j.situacao === 'cedo') { espera = setTimeout(atualizar, 60000); return cartao(cab + '<p class="dica">A sala abre 30 minutos antes do horário. Deixe esta página aberta: ela atualiza sozinha.</p>'); }
    cartao(cab +
      '<div class="termo"><h2>Termo de consentimento para teleconsulta</h2><ul>' +
      '<li>A consulta é feita por vídeo, pela internet, com o profissional da clínica.</li>' +
      '<li>Ela não substitui procedimentos que precisam ser presenciais, como a aplicação de agulhas. Se for preciso, o profissional vai indicar um atendimento presencial.</li>' +
      '<li>A chamada <b>não é gravada</b>. Escolha um lugar reservado e, se puder, use fones de ouvido.</li>' +
      '<li>Seus dados são tratados conforme a LGPD e ficam sob sigilo profissional. Registramos a data, a hora e o endereço de internet deste aceite.</li>' +
      '<li>A qualidade depende da sua conexão. Se a chamada cair, entre de novo por este mesmo link.</li></ul></div>' +
      '<label class="aceite"><input type="checkbox" id="aceito"> <span>Li e aceito o termo de teleconsulta.</span></label>' +
      '<button class="btn" id="entrar" disabled>Entrar na consulta</button><p class="erro" id="msg" hidden></p>' +
      '<p class="dica">Ao entrar, o navegador vai pedir para usar a câmera e o microfone: toque em Permitir.</p>');
    var c = document.getElementById('aceito'), b = document.getElementById('entrar');
    c.addEventListener('change', function(){ b.disabled = !c.checked; });
    b.addEventListener('click', entrar);
  }
  function entrar(){
    var b = document.getElementById('entrar'), m = document.getElementById('msg');
    b.disabled = true; b.textContent = 'Abrindo…'; m.hidden = true;
    pedir(true).then(function(j){
      if (j.url) { document.getElementById('video-f').src = j.url; document.getElementById('video').hidden = false; tela.hidden = true; return; }
      if (j.situacao && j.situacao !== 'aberta') return mostrar(j);
      m.textContent = j.msg || 'Não deu certo agora. Tente de novo em instantes.'; m.hidden = false; b.disabled = false; b.textContent = 'Entrar na consulta';
    }).catch(function(){ m.textContent = 'Sem conexão. Confira a internet e tente de novo.'; m.hidden = false; b.disabled = false; b.textContent = 'Entrar na consulta'; });
  }
  function atualizar(){
    if (!/^[0-9a-f-]{36}$/i.test(id)) return mostrar({ erro:'nao_encontrada', msg:'Link incompleto. Abra de novo o link que você recebeu pelo WhatsApp.' });
    pedir(false).then(mostrar).catch(function(){ cartao('<h1>Sem conexão</h1><p class="erro">Confira a internet e toque para tentar de novo.</p><button class="btn sec" id="denovo">Tentar de novo</button>'); document.getElementById('denovo').onclick = atualizar; });
  }
  window.__consulta = { URL_FUNCAO:URL_FUNCAO };
  atualizar();
})();
