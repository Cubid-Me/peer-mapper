const MOONSCAN_URL = "https://moonbeam.moonscan.io/";
const FALLBACK_HTML = `<!doctype html><html><head><title>Moonbeam indexer unavailable</title></head><body><main><h1>Moonbeam indexer unavailable</h1><p>We couldn't load the Moonbeam explorer right now. Try opening it in a new tab.</p></main></body></html>`;

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await fetch(MOONSCAN_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    let html = await response.text();

    if (!/<base\s/i.test(html)) {
      if (/<head>/i.test(html)) {
        html = html.replace(/<head>/i, `<head><base href="${MOONSCAN_URL}">`);
      } else {
        html = `<head><base href="${MOONSCAN_URL}"></head>${html}`;
      }
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=300",
      },
      status: 200,
    });
  } catch (error) {
    return new Response(FALLBACK_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
      status: 502,
      statusText: error instanceof Error ? error.message : "Failed to load Moonbeam explorer",
    });
  }
}
