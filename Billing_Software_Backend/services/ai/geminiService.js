const stripJsonFences = (value = "") =>
  value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status) => [500, 503, 504].includes(Number(status));

const shouldTryFallback = (status, errorText = "") => {
  const normalized = String(errorText || "").toLowerCase();
  return (
    Number(status) === 429 ||
    Number(status) === 503 ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("high demand") ||
    normalized.includes("unavailable")
  );
};

const requestModel = async ({ model, apiKey, prompt, filePart, maxRetries, baseDelayMs }) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: filePart.mimeType,
                    data: filePart.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      lastError = new Error(`Gemini API error: ${response.status} ${errorText}`);
      lastError.status = response.status;
      lastError.errorText = errorText;
      lastError.model = model;

      if (shouldRetryStatus(response.status) && attempt < maxRetries) {
        await sleep(baseDelayMs * attempt);
        continue;
      }

      throw lastError;
    }

    const payload = await response.json();
    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      lastError = new Error("Gemini returned an empty response");
      lastError.model = model;
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw lastError;
    }

    return JSON.parse(stripJsonFences(text));
  }

  throw lastError || new Error("Gemini request failed");
};

const generateStructuredContent = async ({ prompt, filePart }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
  const maxRetries = Number(process.env.GEMINI_RETRY_ATTEMPTS || 2);
  const baseDelayMs = Number(process.env.GEMINI_RETRY_DELAY_MS || 400);

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    return await requestModel({
      model: primaryModel,
      apiKey,
      prompt,
      filePart,
      maxRetries,
      baseDelayMs,
    });
  } catch (primaryError) {
    if (
      fallbackModel &&
      fallbackModel !== primaryModel &&
      shouldTryFallback(primaryError?.status, primaryError?.errorText)
    ) {
      try {
        return await requestModel({
          model: fallbackModel,
          apiKey,
          prompt,
          filePart,
          maxRetries: 1,
          baseDelayMs,
        });
      } catch (fallbackError) {
        throw new Error(
          `Primary Gemini model (${primaryModel}) failed and fallback model (${fallbackModel}) also failed. Last error: ${fallbackError.message}`
        );
      }
    }

    if (Number(primaryError?.status) === 503) {
      throw new Error(
        "Gemini is temporarily under high demand. Please try scanning again in a few seconds."
      );
    }

    throw primaryError;
  }
};

module.exports = {
  generateStructuredContent,
};
