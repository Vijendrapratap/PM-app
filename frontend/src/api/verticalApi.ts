import api, { expectArray } from './index';

export interface Vertical {
  _id: string;
  name: string;
  code: string;
  kind: 'PRODUCT' | 'CLIENT_SERVICES';
  active: boolean;
  head: { _id: string; name: string; email: string; active: boolean } | null;
}

export const verticalApi = {
  list: () => api.get<Vertical[]>('/verticals').then((response) => expectArray<Vertical>(response.data)),
};
