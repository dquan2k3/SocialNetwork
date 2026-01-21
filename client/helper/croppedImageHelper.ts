function getCloudinaryImageLink(
  url: string,
  croppedArea: any,
  size: number = 190,
  options: { rounded?: boolean } = {}
): string {
  if (!url) {
    return "https://res.cloudinary.com/dpztbd1zk/image/upload/v1758185440/noneAvatar_cyftwm.jpg";
  }
  const rawUrl = String(url).replace(/^"+|"+$/g, "");
  let area;
  try {
    area = typeof croppedArea === "string" ? JSON.parse(croppedArea) : croppedArea;
  } catch {
    return rawUrl; // fallback
  }
  if (!area || area.width == null || area.height == null) {
    return rawUrl;
  }

  const { x, y, width, height } = area;
  let transform = `/upload/c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}/c_fill,w_${size},h_${size}`;

  if (options.rounded) {
    transform += ",r_max";
  }
  transform += "/";

  return rawUrl.replace("/upload/", transform);
}

function getCloudinaryCoverLink(
  url: string,
  croppedArea: any,
  outW: number = 1233,
  outH: number = 460
): string {
  if (!url) return "";
  const rawUrl = String(url).replace(/^"+|"+$/g, "");
  if (!croppedArea) return rawUrl;
  let area;
  try {
    area = typeof croppedArea === "string" ? JSON.parse(croppedArea) : croppedArea;
  } catch {
    return rawUrl;
  }
  if (!area || area.width == null || area.height == null) {
    return rawUrl;
  }
  const { x, y, width, height } = area;
  const transform =
    `/upload/c_crop,x_${Math.round(x)},y_${Math.round(y)},` +
    `w_${Math.round(width)},h_${Math.round(height)}` +
    `/c_fill,w_${outW},h_${outH}/`;

  return rawUrl.replace("/upload/", transform);
}

export { getCloudinaryImageLink, getCloudinaryCoverLink };
