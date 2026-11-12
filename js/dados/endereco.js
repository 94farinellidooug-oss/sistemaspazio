// Endereço do paciente com CEP (pedido do Maicon em 12/11/2026): ao digitar o CEP, o sistema busca rua, bairro,
// cidade e estado no ViaCEP (serviço público e gratuito, sem cadastro); falta só o número e o complemento.
// No cadastro: endereco (rua), numero, complemento, bairro, cidade, uf e cep. Cadastros antigos têm o
// endereço inteiro em endereco, e continuam aparecendo iguais.
export const soDigitosCep = v => String(v || '').replace(/\D/g, '').slice(0, 8);
export const cepFormatado = v => { const d = soDigitosCep(v); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };

// Busca o CEP: devolve { rua, bairro, cidade, uf } ou null (CEP inexistente). Erro de rede lança.
export const buscarCep = async (cep, f = (...a) => fetch(...a)) => {
  const d = soDigitosCep(cep);
  if (d.length !== 8) return null;
  const r = await f(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) { if (r.status === 400) return null; throw new Error('cep ' + r.status); }
  const j = await r.json();
  if (!j || j.erro) return null;
  return { rua:j.logradouro || '', bairro:j.bairro || '', cidade:j.localidade || '', uf:j.uf || '' };
};

// Uma linha só, para o prontuário e os documentos: "Rua X, 123, apto 4 · Bairro · CEP 95000-000".
export function enderecoCompleto(c = {}){
  const rua = [c.endereco, c.numero, c.complemento].map(x => String(x || '').trim()).filter(Boolean).join(', ');
  return [rua, String(c.bairro || '').trim(), c.cep ? `CEP ${cepFormatado(c.cep)}` : ''].filter(Boolean).join(' · ');
}
