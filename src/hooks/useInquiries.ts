import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Inquiry, InquiryInput } from '../types';

// DB 行 → アプリのモデル
function rowToInquiry(r: Record<string, unknown>): Inquiry {
  return {
    id:              r.id as string,
    inquiryDate:     r.inquiry_date as string,
    inquiryTime:     (r.inquiry_time as string | null) ?? null,
    category:        (r.category as string | null) ?? null,
    source:          (r.source as string | null) ?? null,
    gaSource:        (r.ga_source as string | null) ?? null,
    existingContact: (r.existing_contact as 'with' | 'without' | null) ?? null,
    channel:         (r.channel as 'tour' | null) ?? null,
    propertyType:    (r.property_type as Inquiry['propertyType']) ?? null,
    contactName:     (r.contact_name as string | null) ?? null,
    contactAddress:  (r.contact_address as string | null) ?? null,
    area:            (r.area as string | null) ?? null,
    propertyId:      (r.property_id as string | null) ?? null,
    salesperson:     (r.salesperson as string | null) ?? null,
    priceStatus:     (r.price_status as Inquiry['priceStatus']) ?? null,
    format:          (r.format as Inquiry['format']) ?? null,
    notes:           (r.notes as string | null) ?? null,
    createdAt:       (r.created_at as string | null) ?? null,
    updatedAt:       (r.updated_at as string | null) ?? null,
    createdBy:       (r.created_by as string | null) ?? null,
    updatedBy:       (r.updated_by as string | null) ?? null,
  };
}

// アプリのモデル → DB 行（部分入力に対応するため undefined 許容）
function inputToRow(i: Partial<InquiryInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (i.inquiryDate     !== undefined) row.inquiry_date     = i.inquiryDate;
  if (i.inquiryTime     !== undefined) row.inquiry_time     = i.inquiryTime;
  if (i.category        !== undefined) row.category         = i.category;
  if (i.source          !== undefined) row.source           = i.source;
  if (i.gaSource        !== undefined) row.ga_source        = i.gaSource;
  if (i.existingContact !== undefined) row.existing_contact = i.existingContact;
  if (i.channel         !== undefined) row.channel          = i.channel;
  if (i.propertyType    !== undefined) row.property_type    = i.propertyType;
  if (i.contactName     !== undefined) row.contact_name     = i.contactName;
  if (i.contactAddress  !== undefined) row.contact_address  = i.contactAddress;
  if (i.area            !== undefined) row.area             = i.area;
  if (i.propertyId      !== undefined) row.property_id      = i.propertyId;
  if (i.salesperson     !== undefined) row.salesperson      = i.salesperson;
  if (i.priceStatus     !== undefined) row.price_status     = i.priceStatus;
  if (i.format          !== undefined) row.format           = i.format;
  if (i.notes           !== undefined) row.notes            = i.notes;
  return row;
}

export function useInquiries(userId: string | undefined) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('inquiry_date', { ascending: false })
      .order('inquiry_time', { ascending: false, nullsFirst: false });
    if (error) {
      console.error('inquiries load error:', error);
      setLoading(false);
      return;
    }
    setInquiries((data ?? []).map(rowToInquiry));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) load();
    else { setInquiries([]); setLoading(true); }
  }, [userId, load]);

  async function addInquiry(input: InquiryInput, userLabel?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const row = inputToRow(input);
    row.created_at = now;
    row.updated_at = now;
    row.created_by = userLabel ?? null;
    row.updated_by = userLabel ?? null;
    const { error } = await supabase.from('inquiries').insert(row);
    if (error) {
      console.error('inquiry insert error:', error);
      if (typeof window !== 'undefined') alert(`反響データの登録に失敗しました：${error.message}`);
      return false;
    }
    await load();
    return true;
  }

  async function updateInquiry(id: string, updates: Partial<InquiryInput>, userLabel?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const row = inputToRow(updates);
    row.updated_at = now;
    row.updated_by = userLabel ?? null;
    const { error } = await supabase.from('inquiries').update(row).eq('id', id);
    if (error) {
      console.error('inquiry update error:', error);
      if (typeof window !== 'undefined') alert(`反響データの更新に失敗しました：${error.message}`);
      return false;
    }
    // 楽観的更新（再ロードを省略）
    setInquiries(prev => prev.map(x => x.id === id ? { ...x, ...updates, updatedAt: now, updatedBy: userLabel ?? null } : x));
    return true;
  }

  async function deleteInquiry(id: string): Promise<boolean> {
    const { error } = await supabase.from('inquiries').delete().eq('id', id);
    if (error) {
      console.error('inquiry delete error:', error);
      if (typeof window !== 'undefined') alert(`反響データの削除に失敗しました：${error.message}`);
      return false;
    }
    setInquiries(prev => prev.filter(x => x.id !== id));
    return true;
  }

  return { inquiries, loading, load, addInquiry, updateInquiry, deleteInquiry };
}
