import { API_BASE_URL, DYMO_BASE_URL } from '@env';

const stripTrailingSlash = (value: string): string => value.trim().replace(/\/$/, '');

const MOBILE_API_BASE = `${stripTrailingSlash(API_BASE_URL)}/api/mobile`;
const DYMO_API_BASE = `${stripTrailingSlash(DYMO_BASE_URL)}/api/rdm`;

export const API_ENDPOINTS = {
  login: `${MOBILE_API_BASE}/signing/login`,
  recoveryBase: `${MOBILE_API_BASE}/signing/recover`,
  reorders: `${MOBILE_API_BASE}/reorders`,
  newFolio: `${MOBILE_API_BASE}/nuevoFolioReorden`,
  lineas: `${MOBILE_API_BASE}/getLineas`,
  areas: `${MOBILE_API_BASE}/getArea`,
  subAreas: `${MOBILE_API_BASE}/getSubArea`,
  maquinas: `${MOBILE_API_BASE}/getMaquinas`,
  defectos: `${MOBILE_API_BASE}/getDefectos`,
  causas: `${MOBILE_API_BASE}/getCausas`,
  numeroParte: `${MOBILE_API_BASE}/getNumeroParte`,
  componentes: `${MOBILE_API_BASE}/getComponentes`,
  saveReorder: `${MOBILE_API_BASE}/saveReorder`,
  saveRDM: `${MOBILE_API_BASE}/saveRDM`,
  newRdmFolio: `${MOBILE_API_BASE}/nuevoFolioRdm`,
};

export const DYMO_ENDPOINTS = {
  print: `${DYMO_API_BASE}/print`,
};