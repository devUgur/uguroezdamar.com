import { Button } from "@ugur/ui";
import { addCustomProvider } from "../actions";

const INPUT = "h-9 rounded-md border border-input bg-background px-3 text-sm";

/** Any OpenAI-compatible endpoint (vLLM, LiteLLM, Azure OpenAI, a regional reseller) as a provider of its own. */
export function CustomProviderForm() {
  return (
    <form action={addCustomProvider} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required maxLength={40} placeholder="z. B. Mein vLLM" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Basis-URL (OpenAI-kompatibel)
        <input name="baseUrl" type="url" required placeholder="https://api.example.com/v1" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        API-Schlüssel
        <input name="apiKey" type="password" autoComplete="off" spellCheck={false} required minLength={8} className={INPUT} />
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input name="private" type="checkbox" className="size-4" />
        Dieser Anbieter wertet Eingaben nicht aus (dann auch für private Repositories zulässig)
      </label>
      <div className="md:col-span-2">
        <Button type="submit">Anbieter hinzufügen</Button>
      </div>
    </form>
  );
}
