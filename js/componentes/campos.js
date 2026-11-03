// Pequenos componentes de interface reaproveitados.
import { EL } from '../conhecimento/elementos.js';
import { db } from '../dados/repositorio.js';
import { esc } from '../util.js';

export const elTag = e => e ? `<span class="el-tag"><i style="background:${EL[e].cor}"></i>${EL[e].nome}</span>` : '';
export const patientSelect = (id,cur) => `<select id="${id}">${db.patients.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`;
