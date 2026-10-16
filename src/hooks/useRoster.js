import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../services';
import { useResource } from './useResource';

/** id -> person, scoped by what the server lets this role see (admin: everyone; leaders: crew + self; employee: self). */
export function useRoster() {
  const { user } = useAuth();
  const { data } = useResource(async () => {
    if (user.role === 'admin') return (await usersApi.list({ includeBank: undefined })).data;
    if (user.role === 'employee') return [];
    return usersApi.crew();
  }, [user.id, user.role]);
  return useMemo(() => {
    const list = [...(data || [])];
    if (!list.some((p) => p.id === user.id)) list.push({ id: user.id, name: user.name, role: user.role, title: user.title, department: user.department, status: user.status, leaderId: user.leaderId, floorId: user.floorId });
    const map = new Map(list.map((p) => [p.id, p]));
    return { list, map, name: (id) => map.get(id)?.name || null };
  }, [data, user]);
}
