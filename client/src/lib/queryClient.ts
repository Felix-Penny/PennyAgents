import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 401, 403, 404
        if (error?.status && [401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

export type GetQueryFnOptions = {
  on401?: "returnNull" | "throw";
};

export function getQueryFn(options: GetQueryFnOptions = {}) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const url = queryKey[0] as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (!res.ok) {
      if (res.status === 401 && options.on401 === "returnNull") {
        return null;
      }
      const errorText = await res.text();
      const error = new Error(errorText || `Request failed with status ${res.status}`);
      (error as any).status = res.status;
      throw error;
    }

    return res.json();
  };
}

export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  body?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText || `Request failed with status ${res.status}`;
    }
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    throw error;
  }

  return res;
}