import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useMe, useOperators, must, type Shift } from "@/hooks/use-safenet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/operadores")({
  head: () => ({
    meta: [
      { title: "Operadores — Monitoramento Safenet" },
      { name: "description", content: "Operadores de monitoramento cadastrados e histórico de plantões." },
      { property: "og:title", content: "Operadores — Monitoramento Safenet" },
      { property: "og:description", content: "Equipe de monitoramento e sessões de plantão." },
    ],
  }),
  component: Operadores,
});

function Operadores() {
  const { data: me } = useMe();
  const { data: ops = [] } = useOperators();
  const inv = useInvalidate();
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-history"],
    queryFn: () => must<Shift[]>(supabase.from("shifts").select("*").order("started_at", { ascending: false }).limit(30)),
  });
  const name = (id: string | null) => ops.find((o) => o.id === id)?.name ?? "—";
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "em andamento");

  const rename = async (v: string) => {
    if (!v.trim()) return;
    await supabase.from("profiles").update({ name: v.trim().slice(0, 100) }).eq("id", me!.id);
    inv("me", "operators"); toast.success("Nome atualizado");
  };
  const toggleAdmin = async (uid: string, isAdmin: boolean) => {
    const { error } = isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) { toast.error(error.message); return; }
    inv("operators", "me");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Operadores</h1>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Meu nome de operador</CardTitle></CardHeader>
        <CardContent>{me && <Input key={me.profile.name} defaultValue={me.profile.name} onBlur={(e) => rename(e.target.value)} className="max-w-sm" />}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Equipe ({ops.length})</CardTitle></CardHeader>
        <CardContent className="divide-y">
          <p className="pb-2 text-xs text-muted-foreground">Novos operadores se cadastram pela tela de login.</p>
          {ops.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-2 text-sm">
              <div><span className="font-medium">{o.name}</span> <span className="text-muted-foreground">{o.email}</span></div>
              <div className="flex items-center gap-2">
                {o.isAdmin && <span className="rounded bg-accent px-1.5 py-0.5 text-xs">admin</span>}
                {me?.isAdmin && o.id !== me.id && <Button size="sm" variant="outline" onClick={() => toggleAdmin(o.id, o.isAdmin)}>{o.isAdmin ? "Remover admin" : "Tornar admin"}</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Sessões de plantão</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Operador</th><th>Turno</th><th>Início</th><th>Fim</th><th>Passou para</th></tr></thead>
            <tbody>{shifts.map((s) => (
              <tr key={s.id} className="border-t"><td className="py-1.5 font-medium">{name(s.operator_id)}</td><td>{s.shift_type}</td><td className="font-mono">{fmt(s.started_at)}</td><td className="font-mono">{fmt(s.ended_at)}</td><td>{name(s.next_operator_id)}</td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
