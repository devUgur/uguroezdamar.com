export type ContactRequestPayload = {
  name: string;
  email: string;
  message: string;
  nickname: string;
};

/** The site owns the API, so contact submissions always remain same-origin. */
export function submitContactRequest(payload: ContactRequestPayload, fetcher: typeof fetch = fetch) {
  return fetcher("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
