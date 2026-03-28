import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function useSupabaseRealtime<T>(
  table: string,
  filter?: { column: string; value: string },
  options?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    schema?: string;
  }
) {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Initial fetch
    const fetchInitialData = async () => {
      try {
        let query = supabase.from(table).select('*');
        
        if (filter) {
          query = query.eq(filter.column, filter.value);
        }

        const { data: initialData, error: fetchError } = await query;
        
        if (fetchError) {
          setError(fetchError);
        } else {
          setData(initialData as T[]);
        }
      } catch (err) {
        setError(err as Error);
      }
    };

    fetchInitialData();

    // Set up real-time subscription
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as any,
        {
          event: options?.event || '*',
          schema: options?.schema || 'public',
          table: table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
        } as any,
        (payload: any) => {
          console.log(`Real-time update on ${table}:`, payload);

          if (payload.eventType === 'INSERT') {
            setData((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item: any) =>
                item.id === (payload.new as any).id ? (payload.new as T) : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item: any) => item.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table} real-time updates`);
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          console.log(`❌ Disconnected from ${table} real-time`);
          setIsConnected(false);
        }
      });

    // Cleanup
    return () => {
      console.log(`🔌 Unsubscribing from ${table}`);
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, options?.event, options?.schema]);

  return { data, isConnected, error };
}

// Helper hook specifically for student sessions
export function useStudentSessionsRealtime(assignmentId: string) {
  return useSupabaseRealtime('student_sessions', {
    column: 'assignment_id',
    value: assignmentId,
  });
}

// Helper hook for submissions
export function useSubmissionsRealtime(assignmentId?: string) {
  return useSupabaseRealtime(
    'submissions',
    assignmentId
      ? { column: 'assignment_id', value: assignmentId }
      : undefined
  );
}
