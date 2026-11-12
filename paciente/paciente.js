// MUSUBI · Área do paciente (link recebido pelo WhatsApp: paciente/?c=<código>).
// O paciente confirma a data de nascimento e vê, numa página só, o que a clínica liberou: próximas consultas,
// orientações para casa, resumo da avaliação, evolução das queixas e documentos. Pode baixar tudo em PDF
// (imprimir > salvar como PDF). Quem decide o que aparece é a clínica (supabase/017_area_paciente.sql).
(function(){
  var URL_RPC = 'https://lmucimqjrzjewfyhcfoh.supabase.co/rest/v1/rpc/ver_area_paciente';
  var CHAVE = 'sb_publishable_kRmZNwp0_Xq4jPPMgTzKKA_SyLsreZS';
  var id = new URLSearchParams(location.search).get('c') || '', tela = document.getElementById('tela');
  var KEY = 'musubi-area-' + id;
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  var dataBr = function(iso){ var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  var diaSemana = function(iso, hora){ var d = new Date(iso + 'T12:00:00'); var s = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' }); return s.charAt(0).toUpperCase() + s.slice(1) + (hora ? ' às ' + hora : ''); };
  var iniciais = function(n){ var p = String(n || '').trim().split(/\s+/); return ((p[0] || '')[0] || '') + (p.length > 1 ? (p[p.length - 1][0] || '') : ''); };
  var mascara = function(v){ var d = String(v).replace(/\D/g, '').slice(0, 8); return d.length <= 2 ? d : d.length <= 4 ? d.slice(0, 2) + '/' + d.slice(2) : d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4); };
  var iso = function(v){ var m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return ''; var d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 && +m[3] > 1900 ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
  var guardado = function(){ try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  var guardar = function(v){ try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) {} };

  function pedir(nasc){
    return fetch(URL_RPC, { method:'POST', headers:{ 'Content-Type':'application/json', apikey:CHAVE }, body:JSON.stringify({ p_id:id, p_nascimento:nasc || null }) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) return { erro:'servidor' }; return j || {}; }); });
  }
  function aviso(titulo, txt){ tela.innerHTML = '<div class="cartao"><h1>' + titulo + '</h1><p class="erro">' + txt + '</p></div>'; }

  function portao(msg){
    tela.innerHTML = '<form class="cartao" id="f-nasc"><h1>Área do paciente</h1><p class="suave">Para a sua segurança, confirme a sua data de nascimento.</p>' +
      '<label class="campo">Data de nascimento<input id="nasc" inputmode="numeric" autocomplete="bday" placeholder="dd/mm/aaaa" maxlength="10" required></label>' +
      '<button class="btn" id="abrir">Abrir</button><p class="erro" id="msg"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p>' +
      '<p class="dica">Este link é pessoal. Não compartilhe com outras pessoas.</p></form>';
    var n = document.getElementById('nasc');
    n.addEventListener('input', function(){ n.value = mascara(n.value); });
    document.getElementById('f-nasc').addEventListener('submit', function(ev){
      ev.preventDefault();
      var d = iso(n.value), m = document.getElementById('msg'), b = document.getElementById('abrir');
      if (!d) { m.textContent = 'Confira a data: dia/mês/ano, por exemplo 12/04/1988.'; m.hidden = false; return; }
      b.disabled = true; b.textContent = 'Abrindo…'; abrir(d);
    });
    n.focus();
  }
  function abrir(d){
    pedir(d).then(function(j){
      if (j.ok && j.conteudo) { guardar(d); return mostrar(j.conteudo, j.atualizado_em); }
      guardar('');
      if (j.erro === 'nao_encontrada') return aviso('Link desligado', 'Este link não está mais ativo. Fale com a clínica para receber um novo.');
      if (j.erro === 'bloqueado') return aviso('Muitas tentativas', 'Por segurança, a página ficou bloqueada por um tempo. Tente de novo mais tarde ou fale com a clínica.');
      if (j.erro === 'data') return portao('A data não confere.' + (j.restam != null ? ' Restam ' + j.restam + ' tentativa' + (j.restam === 1 ? '' : 's') + '.' : ''));
      portao('Não deu certo agora. Tente de novo em instantes.');
    }).catch(function(){ portao('Sem conexão. Confira a internet e tente de novo.'); });
  }

  function grafico(p){
    var n = p.length; if (n < 2) return '';
    var x = function(i){ return 6 + i * (288 / (n - 1)); }, y = function(v){ return 6 + (10 - v) * 4.4; };
    var pts = p.map(function(q, i){ return x(i).toFixed(1) + ',' + y(q.valor).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 300 56" preserveAspectRatio="none" role="img" aria-label="Intensidade de 0 a 10 por atendimento"><polyline points="' + pts + '" fill="none" stroke="var(--verde)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      p.map(function(q, i){ return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(q.valor).toFixed(1) + '" r="3" fill="var(--ouro)"/>'; }).join('') + '</svg>';
  }
  function secao(t, corpo){ return '<section class="cartao"><h2><i></i>' + t + '</h2>' + corpo + '</section>'; }

  function mostrar(c, quando){
    var h = '', prof = c.profissional || '';
    h += '<section class="cartao"><h1>Olá, ' + esc(String(c.paciente || '').split(/\s+/)[0]) + '!</h1><p class="suave">Esta é a sua área na ' + esc(c.clinica || 'clínica') + '.</p>' +
      (prof ? '<div class="prof" style="margin-top:16px"><span class="av" aria-hidden="true">' + esc(iniciais(prof).toUpperCase()) + '</span><div class="grow"><span class="suave">Profissional responsável</span><b>' + esc(prof) + '</b><span class="suave">' + esc(c.clinica || '') + '</span></div></div>' : '') +
      (quando ? '<p class="atual">Atualizada em ' + esc(dataBr(quando)) + '.</p>' : '') + '</section>';
    if (c.consultas) h += secao('Próximas consultas', c.consultas.length ? '<ul class="lista">' + c.consultas.map(function(a){
      return '<li class="item"><div class="t">' + esc(diaSemana(a.data, a.hora)) + (a.online ? '<span class="selo">online</span>' : '') + '</div><div class="d">' + esc(a.tipo) + '</div>' +
        (a.online && a.link ? '<a class="link-on noprint" href="' + esc(a.link) + '">Entrar na consulta online</a>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="suave">Nenhuma consulta marcada no momento.</p>');
    if (c.orientacoes) h += secao('Orientações para casa', c.orientacoes.length ? '<ul class="lista">' + c.orientacoes.map(function(o, i){
      return '<li class="item"><div class="d">' + (i === 0 ? 'Mais recentes · ' : '') + 'atendimento de ' + esc(dataBr(o.data)) + '</div><p>' + esc(o.texto) + '</p></li>';
    }).join('') + '</ul>' : '<p class="suave">Ainda não há orientações registradas.</p>');
    if (c.resumo) h += secao('Resumo da avaliação', '<div class="item"><p style="margin:0">' + esc(c.resumo.texto) + '</p>' + (c.resumo.data ? '<div class="d" style="margin-top:8px">Escrito em ' + esc(dataBr(c.resumo.data)) + (prof ? ' por ' + esc(prof) : '') + '</div>' : '') + '</div>');
    if (c.dor && c.dor.length) h += secao('Evolução das queixas', '<p class="suave" style="margin-bottom:12px">Intensidade de 0 (nada) a 10 (máxima), em cada atendimento.</p><div class="dor">' + c.dor.map(function(q){
      var a = q.pontos[0].valor, b = q.pontos[q.pontos.length - 1].valor;
      return '<div class="q item"><span class="n">' + esc(q.nome) + (q.ativa ? '' : ' <span class="selo">resolvida</span>') + '</span><span class="v">' + a + ' → ' + b + '</span>' + grafico(q.pontos) + '</div>';
    }).join('') + '</div>');
    if (c.documentos && c.documentos.length) h += secao('Documentos', '<div class="lista">' + c.documentos.map(function(d){
      return '<details class="item"><summary><span>' + esc(d.nome) + ' <span class="d">· ' + esc(dataBr(d.data)) + '</span>' + (d.assinado ? '<span class="selo">assinado</span>' : '') + '</span></summary><p>' + esc(d.texto) + '</p></details>';
    }).join('') + '</div>');
    h += '<div class="acoes"><button class="btn" id="baixar" type="button">Baixar em PDF</button><button class="btn sec" id="sair" type="button">Sair</button></div>';
    tela.innerHTML = h;
    document.getElementById('baixar').onclick = function(){ window.print(); };
    document.getElementById('sair').onclick = function(){ guardar(''); portao(); };
  }
  addEventListener('beforeprint', function(){ document.querySelectorAll('details').forEach(function(d){ d.open = true; }); });

  window.__area = { URL_RPC:URL_RPC };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return aviso('Link incompleto', 'Abra de novo o link que você recebeu pelo WhatsApp.');
  var g = guardado(); if (g) abrir(g); else pedir(null).then(function(j){
    if (j.erro === 'nao_encontrada') return aviso('Link desligado', 'Este link não está mais ativo. Fale com a clínica para receber um novo.');
    if (j.erro === 'bloqueado') return aviso('Muitas tentativas', 'Por segurança, a página ficou bloqueada por um tempo. Tente de novo mais tarde ou fale com a clínica.');
    portao();
  }).catch(function(){ portao(); });
})();
