import { useState, useEffect, useCallback } from 'react';
import type { Property, Task } from '../types';
import { DEFAULT_TASKS } from '../constants';
import { supabase } from '../lib/supabase';

function generateId(properties: Property[]): string {
  const max = properties.reduce((m, p) => {
    const n = parseInt(p.id.replace('P-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `P-${String(max + 1).padStart(3, '0')}`;
}

function buildDefaultTasks(): Task[] {
  return DEFAULT_TASKS.map((t, i) => ({
    id: `task-${i}`,
    name: t.name,
    startDate: null,
    endDate: null,
  }));
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: props } = await supabase
      .from('properties')
      .select('id, name, created_at')
      .order('created_at');

    if (!props) { setLoading(false); return; }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index');

    const result: Property[] = props.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      tasks: (tasks ?? [])
        .filter(t => t.property_id === p.id)
        .map(t => ({
          id: t.id,
          name: t.name,
          startDate: t.start_date ?? null,
          endDate: t.end_date ?? null,
        })),
    }));

    setProperties(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProperty(name: string) {
    const id = generateId(properties);

    await supabase.from('properties').insert({ id, name });

    const defaultTasks = buildDefaultTasks();
    await supabase.from('tasks').insert(
      defaultTasks.map((t, i) => ({
        id: t.id,
        property_id: id,
        name: t.name,
        start_date: null,
        end_date: null,
        order_index: i,
      }))
    );

    await load();
    setSelectedId(id);
  }

  async function updateTask(propertyId: string, taskId: string, updates: Partial<Task>) {
    // 楽観的更新
    setProperties(prev =>
      prev.map(p =>
        p.id !== propertyId ? p :
          { ...p, tasks: p.tasks.map(t => t.id !== taskId ? t : { ...t, ...updates }) }
      )
    );

    await supabase.from('tasks')
      .update({
        start_date: updates.startDate ?? null,
        end_date:   updates.endDate   ?? null,
      })
      .eq('property_id', propertyId)
      .eq('id', taskId);
  }

  async function deleteProperty(propertyId: string) {
    await supabase.from('properties').delete().eq('id', propertyId);
    setProperties(prev => prev.filter(p => p.id !== propertyId));
    setSelectedId(prev => prev === propertyId ? null : prev);
  }

  const selectedProperty = properties.find(p => p.id === selectedId) ?? null;

  return {
    properties, selectedProperty, selectedId, loading,
    setSelectedId, addProperty, updateTask, deleteProperty,
  };
}
