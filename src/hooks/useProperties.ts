import { useState, useEffect, useCallback } from 'react';
import type { Property, Task } from '../types';
import { supabase } from '../lib/supabase';

function generatePropertyId(properties: Property[]): string {
  const max = properties.reduce((m, p) => {
    const n = parseInt(p.id.replace('P-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `P-${String(max + 1).padStart(3, '0')}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: props } = await supabase
      .from('properties')
      .select('id, name, created_at, assignee_id')
      .order('created_at');

    if (!props) { setLoading(false); return; }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .order('order_index');

    const result: Property[] = props.map(p => {
      // property_idで絞り込んだあと、idで重複除去（念のため）
      const seen = new Set<string>();
      const propertyTasks = (tasks ?? [])
        .filter(t => t.property_id === p.id)
        .filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .map(t => ({
          id: t.id,
          name: t.name,
          color: t.color ?? '#6B7280',
          startDate: t.start_date ?? null,
          endDate: t.end_date ?? null,
        }));

      return {
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
        assigneeId: p.assignee_id ?? null,
        tasks: propertyTasks,
      };
    });

    setProperties(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProperty(name: string) {
    const id = generatePropertyId(properties);
    const { error: propError } = await supabase.from('properties').insert({ id, name });
    if (propError) { console.error('property insert error:', propError); return; }

    const { data: templates } = await supabase
      .from('task_templates')
      .select('*')
      .order('order_index');

    if (templates && templates.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(
        templates.map((t, i) => ({
          id: uuid(),        // UUIDで一意性を保証
          property_id: id,
          name: t.name,
          color: t.color,
          start_date: null,
          end_date: null,
          order_index: i,
        }))
      );
      if (taskError) console.error('tasks insert error:', taskError);
    }

    await load();
    setSelectedId(id);
  }

  async function copyProperty(sourceId: string, newName: string, copyDates: boolean) {
    const source = properties.find(p => p.id === sourceId);
    if (!source) return;

    const id = generatePropertyId(properties);
    const { error: propError } = await supabase.from('properties').insert({ id, name: newName });
    if (propError) { console.error('property insert error:', propError); return; }

    if (source.tasks.length > 0) {
      const { error: taskError } = await supabase.from('tasks').insert(
        source.tasks.map((t, i) => ({
          id: uuid(),        // UUIDで一意性を保証（コピー元のIDと絶対に被らない）
          property_id: id,
          name: t.name,
          color: t.color,
          start_date: copyDates ? t.startDate : null,
          end_date: copyDates ? t.endDate : null,
          order_index: i,
        }))
      );
      if (taskError) console.error('tasks insert error:', taskError);
    }

    await load();
    setSelectedId(id);
  }

  async function updateTask(propertyId: string, taskId: string, updates: Partial<Task>) {
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

  async function updateAssignee(propertyId: string, assigneeId: string | null) {
    setProperties(prev =>
      prev.map(p => p.id === propertyId ? { ...p, assigneeId } : p)
    );
    await supabase.from('properties')
      .update({ assignee_id: assigneeId })
      .eq('id', propertyId);
  }

  async function deleteProperty(propertyId: string) {
    await supabase.from('properties').delete().eq('id', propertyId);
    setProperties(prev => prev.filter(p => p.id !== propertyId));
    setSelectedId(prev => prev === propertyId ? null : prev);
  }

  const selectedProperty = properties.find(p => p.id === selectedId) ?? null;

  return {
    properties, selectedProperty, selectedId, loading,
    setSelectedId, addProperty, copyProperty, updateTask, updateAssignee, deleteProperty,
  };
}
