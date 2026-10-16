
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "method_not_allowed"
    });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(503).json({
      error: "make_webhook_not_configured"
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "MYLIFE Test",
        message: "Telegram connection test successful!"
      })
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "make_webhook_failed"
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Test sent to Make"
    });
  } catch (error) {
    return res.status(500).json({
      error: "request_failed"
    });
  }
};
