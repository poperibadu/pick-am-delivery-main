import { useEffect, useState, useCallback } from 'react';
import supabase from '../lib/supabase';

export function usePackageWebSocket(packageId, onUpdate) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!packageId) return;

    const channel = supabase
      .channel(`package-${packageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packages',
          filter: `id=eq.${packageId}`,
        },
        (payload) => {
          if (onUpdate) onUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [packageId, onUpdate]);

  return { connected };
}

export function useUserWebSocket(userId, onMessage) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Listen to package changes where user is sender
    const channel = supabase
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          if (onMessage) onMessage({ type: 'package_update', package_id: payload.new.id, data: payload.new });
        }
      )
      // Note: Supabase RLS limits who can see what, but we can also listen to profile changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (onMessage) onMessage({ type: 'profile_update', data: payload.new });
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onMessage]);

  return { connected };
}

export function useRiderWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Riders listen for any package that's 'searching_rider'
    const channel = supabase
      .channel('rider-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'packages',
          filter: 'status=eq.searching_rider',
        },
        (payload) => {
          if (onMessage) {
            if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && payload.new.status === 'searching_rider')) {
              onMessage({ type: 'new_job', data: payload.new });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'packages',
        },
        (payload) => {
          // If a job is taken by someone else
          if (payload.old.status === 'searching_rider' && payload.new.status !== 'searching_rider') {
             if (onMessage) onMessage({ type: 'job_taken', package_id: payload.new.id, data: payload.new });
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onMessage]);

  return { connected };
}

