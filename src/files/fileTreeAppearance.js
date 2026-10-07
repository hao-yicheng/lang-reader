import { STUDY_UPLOAD_SVG } from "../ui/uiIcons.js";

export const FILE_GROUP_STYLE = Object.freeze({
  sectionStyle: "frame", frameColor: "mid-gray", frameStyle: "dashed", uploadStyle: "upload"
});

export const FILE_GROUP_APPEARANCE = Object.freeze({
  className: () => "section-frame frame-color-mid-gray frame-style-dashed",
  addIcon: kind => ["uploaded-files", "uploaded-folders"].includes(kind) ? STUDY_UPLOAD_SVG : undefined
});
