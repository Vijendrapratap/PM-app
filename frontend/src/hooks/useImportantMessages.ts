import { useCallback, useEffect, useState } from 'react';
import { messageApi, type ImportantMessage } from '../api/messageApi';
import { useAuth } from '../context/AuthContext';

export const useImportantMessages = () => {
  const { isDemo } = useAuth();
  const [messages, setMessages] = useState<ImportantMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // Demo mode has no real backend session (see AuthContext.startDemo) -
    // fetching here would 401 and force-logout the demo user.
    if (isDemo) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessages(await messageApi.listActive());
    } catch (error) {
      console.error('Failed to fetch active messages', error);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { messages, loading, refetch };
};
