import { useCallback, useEffect, useState } from 'react';
import { messageApi, type ImportantMessage } from '../api/messageApi';

export const useImportantMessages = () => {
  const [messages, setMessages] = useState<ImportantMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setMessages(await messageApi.listActive());
    } catch (error) {
      console.error('Failed to fetch active messages', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { messages, loading, refetch };
};
