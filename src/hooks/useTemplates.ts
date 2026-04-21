import { useState, useEffect, useCallback } from 'react';
import type { TaskTemplate } from '../types';
import { supabase } from '../lib/supabase';

export function useTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('task_templates').select('*').order('order_index');
    if (data) {
      setTemplates(data.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        orderIndex: t.order_index,
      })));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTemplate(name: string, color: string) {
    const id = `tt-${Date.now()}`;
    const orderIndex = templates.length;
    await supabase.from('task_templates').insert({ id, name, color, order_index: orderIndex });

    // Append to every existing property's task list so the new step shows up immediately.
    const { data: props } = await supabase.from('properties').select('id');
    if (props && props.length > 0) {
      const { data: existingTasks } = await supabase.from('tasks').select('property_id, order_index');
      const maxByProperty = new Map<string, number>();
      (existingTasks ?? []).forEach(t => {
        const cur = maxByProperty.get(t.property_id) ?? -1;
        if (t.order_index > cur) maxByProperty.set(t.property_id, t.order_index);
      });

      const newTasks = props.map(p => ({
        id: crypto.randomUUID(),
        property_id: p.id,
        name,
        color,
        start_date: null,
        end_date: null,
        order_index: (maxByProperty.get(p.id) ?? -1) + 1,
      }));

      await supabase.from('tasks').insert(newTasks);
    }

    await load();
  }

  async function updateTemplate(id: string, updates: Partial<Pick<TaskTemplate, 'name' | 'color'>>) {
    await supabase.from('task_templates').update({ name: updates.name, color: updates.color }).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  async function deleteTemplate(id: string) {
    await supabase.from('task_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function reorderTemplates(orderedIds: string[]) {
    const byId = new Map(templates.map(t => [t.id, t]));
    const newList = orderedIds
      .map(id => byId.get(id))
      .filter((t): t is TaskTemplate => !!t);
    if (newList.length !== templates.length) return;

    setTemplates(newList);
    await Promise.all(
      newList.map((t, i) =>
        supabase.from('task_templates').update({ order_index: i }).eq('id', t.id)
      )
    );
  }

  return { templates, load, addTemplate, updateTemplate, deleteTemplate, reorderTemplates };
}
