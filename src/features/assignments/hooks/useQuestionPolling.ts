import { useQuery } from "@tanstack/react-query";

export function useQuestionPolling(assignmentId: string, initialQuestions: any[], enabled: boolean) {
  const { data: questions = initialQuestions } = useQuery({
    queryKey: ["live-questions", assignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/assignments/${assignmentId}/questions`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      return data.questions || [];
    },
    enabled,
    refetchInterval: 3000,
    initialData: initialQuestions,
  });

  return { questions };
}
