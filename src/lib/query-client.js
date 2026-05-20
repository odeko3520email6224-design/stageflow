import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchInterval: 3000,
			refetchIntervalInBackground: true,
			retry: 1,
			staleTime: 0,
		},
	},
});
