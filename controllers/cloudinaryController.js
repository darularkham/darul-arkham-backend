import cloudinary from "../config/cloudinary.js";

export const getSignature = (req, res) => {
  try {
    const { folder } = req.body;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign = { timestamp, folder };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
      },
    });
  } catch (error) {
    console.error("[cloudinaryController] Signature Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { publicId, resourceType, folder } = req.body;
    if (!publicId) {
      return res.status(400).json({ success: false, message: "Missing publicId" });
    }

    let resolvedType = resourceType || "image";
    const normFolder = String(folder || "").toLowerCase();

    if (normFolder.includes("audio") || normFolder.includes("video")) {
      resolvedType = "video";
    } else if (normFolder.includes("doc") || normFolder.includes("raw")) {
      resolvedType = "raw";
    } else {
      resolvedType = "image";
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resolvedType,
    });

    if (result.result === "ok" || result.result === "not_found") {
      res.json({ success: true, message: "File deleted successfully from Cloudinary." });
    } else {
      res.status(400).json({ success: false, message: `Cloudinary delete failed: ${result.result}` });
    }
  } catch (error) {
    console.error("[cloudinaryController] Delete Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
