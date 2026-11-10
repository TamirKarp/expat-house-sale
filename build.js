#!/usr/bin/env node
// Turns a folder of photos into the files the website needs.
//
//   node build.js "/path/to/your/photos"
//
// - Photos in the folder are shown as for sale.
// - Photos in a sub-folder called "sold" are shown as sold.
// - The file name becomes the item name: "03-oak-dining-table.jpg" becomes "Oak dining table".
// - Items appear in file name order, so start names with 01-, 02- and so on to control the order.
// - Several photos of one item: put the view in brackets, "oak-table (front).jpg" and
//   "oak-table (side).jpg". They share one tile and one pop-up, labelled Front and Side.
//
// Needs a Mac (it uses the built-in "sips" tool to shrink photos so the site loads fast).
// Photos also get a light touch-up from scripts/enhance.py (needs python3 with Pillow and numpy).
// The original photos are never changed.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = __dirname;
const imagesDir = path.join(root, "images");
const IMAGE = /\.(jpe?g|png|heic|heif|webp)$/i;
const THUMB_SIZE = 800;
const FULL_SIZE = 1600;

const arg = process.argv[2] || process.env.PHOTOS_DIR || path.join(root, "photos");
const source = path.resolve(arg.replace(/^~(?=$|\/)/, os.homedir()));

if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  console.error("Cannot find the photo folder: " + source);
  console.error('Run it like this:  node build.js "/path/to/your/photos"');
  process.exit(1);
}

function sips(...args) {
  return execFileSync("sips", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Size as it appears on screen (phone photos are often stored sideways with a rotate flag).
function dimensions(file) {
  const out = sips("-g", "pixelWidth", "-g", "pixelHeight", "-g", "orientation", file);
  const num = (key) => Number((out.match(new RegExp(key + ":\\s*(\\d+)")) || [])[1]);
  let w = num("pixelWidth");
  let h = num("pixelHeight");
  const orientation = num("orientation") || 1;
  if (orientation >= 5 && orientation <= 8) [w, h] = [h, w];
  return { w, h, longest: Math.max(w, h) };
}

function makeJpeg(input, output, size) {
  const args = ["-s", "format", "jpeg", "-s", "formatOptions", "80"];
  if (dimensions(input).longest > size) args.push("-Z", String(size)); // never enlarge
  sips(...args, input, "--out", output);
}

// Light touch-up (brightness, contrast, gentle sharpening) and a thumbnail, done by scripts/enhance.py.
// Rewrites the full-size file in place. Returns false if python3 or Pillow is missing, so the
// build still works, just without the touch-up.
let warnedNoEnhance = false;
function enhanceInto(full, thumb) {
  try {
    execFileSync("python3", [path.join(root, "scripts", "enhance.py"), full, full, thumb, String(THUMB_SIZE)], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch (err) {
    if (!warnedNoEnhance) {
      console.warn("Photo touch-up skipped (needs python3 with the Pillow and numpy packages). Photos are only resized.");
      warnedNoEnhance = true;
    }
    return false;
  }
}

function listImages(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && IMAGE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function titleFrom(file) {
  const text = file
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[\s._-]+/, "")
    .replace(/_+/g, " ")
    .replace(/-+/g, (dash) => (/\s/.test(file) ? dash : " ")) // keep hyphens in names that already use spaces ("5-hob")
    .replace(/\s+/g, " ")
    .replace(/[\s.]+$/, "") // "Wooden dining table. .jpeg" shows as "Wooden dining table"
    .trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Item";
}

function slugFrom(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

const soldFolder = fs
  .readdirSync(source, { withFileTypes: true })
  .find((e) => e.isDirectory() && e.name.toLowerCase() === "sold");

const jobs = [
  ...listImages(source).map((name) => ({ file: path.join(source, name), name, sold: false })),
  ...(soldFolder
    ? listImages(path.join(source, soldFolder.name)).map((name) => ({
        file: path.join(source, soldFolder.name, name),
        name,
        sold: true,
      }))
    : []),
];

fs.rmSync(imagesDir, { recursive: true, force: true });
fs.mkdirSync(path.join(imagesDir, "thumb"), { recursive: true });
fs.mkdirSync(path.join(imagesDir, "full"), { recursive: true });

// Photos named "Oak table (front).jpg" and "Oak table (side).jpg" are two views of one item:
// they share one tile called "Oak table", and the words in brackets label each view.
function splitView(title) {
  const match = title.match(/^(.*\S)\s*\(([^)]*\S[^)]*)\)$/);
  if (!match) return { base: title, label: "" };
  const label = match[2].trim();
  return { base: match[1], label: label[0].toUpperCase() + label.slice(1) };
}

function unique(slug, taken) {
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = slug + "-" + n;
  taken.add(id);
  return id;
}

const prepared = jobs.map((job) => {
  const title = titleFrom(job.name);
  const view = splitView(title);
  return { ...job, title, ...view, key: (job.sold ? "sold:" : "sale:") + view.base.toLowerCase() };
});
const viewsPerKey = {};
for (const p of prepared) viewsPerKey[p.key] = (viewsPerKey[p.key] || 0) + 1;

const usedPhotoIds = new Set();
const usedItemIds = new Set();
const groups = new Map();

for (const job of prepared) {
  const photoId = unique(slugFrom(job.title), usedPhotoIds);
  const thumb = path.join(imagesDir, "thumb", photoId + ".jpg");
  const full = path.join(imagesDir, "full", photoId + ".jpg");
  try {
    makeJpeg(job.file, full, FULL_SIZE);
    if (!enhanceInto(full, thumb)) makeJpeg(job.file, thumb, THUMB_SIZE);
    const { w, h } = dimensions(thumb);

    const grouped = viewsPerKey[job.key] > 1;
    const groupKey = grouped ? job.key : "single:" + photoId;
    let item = groups.get(groupKey);
    if (!item) {
      const title = grouped ? job.base : job.title;
      item = { id: unique(slugFrom(title), usedItemIds), title, sold: job.sold, photos: [] };
      groups.set(groupKey, item);
    }
    item.photos.push({
      label: grouped ? job.label : "",
      thumb: "images/thumb/" + photoId + ".jpg",
      full: "images/full/" + photoId + ".jpg",
      w,
      h,
    });
    if (/^(img|dsc|pxl)[\s_-]?\d+$/i.test(job.title)) {
      console.log('Tip: "' + job.name + '" will show as "' + job.title + '". Rename it (for example oak-dining-table.jpg) to give it a proper name.');
    }
  } catch (err) {
    console.warn("Skipped " + job.name + ": could not read it as a photo.");
  }
}

let items = [...groups.values()];

// Optional extras from details.json, matched by item name: a price, a description, and
// "room" (Kitchen, Living room, Bedroom or any name) to file it under a heading, and
// "last": true to show the item in its own feature row at the bottom of the page.
const detailsFile = path.join(root, "details.json");
if (fs.existsSync(detailsFile)) {
  let details = {};
  try {
    details = JSON.parse(fs.readFileSync(detailsFile, "utf8"));
  } catch (err) {
    console.error("details.json is not valid JSON, so it was ignored: " + err.message);
  }
  for (const [name, extra] of Object.entries(details)) {
    const item = items.find((i) => i.title.toLowerCase() === name.toLowerCase());
    if (!item) {
      console.warn('details.json has "' + name + '" but no photo is called that, so it was ignored.');
      continue;
    }
    if (extra.price) item.price = extra.price;
    if (extra.description) item.description = extra.description;
    if (extra.last) item.last = true;
    if (extra.room) item.room = extra.room;
  }
}
items = [...items.filter((i) => !i.last), ...items.filter((i) => i.last)];

fs.writeFileSync(
  path.join(root, "items.js"),
  "// Written by build.js. Do not edit by hand; run build.js again instead.\nwindow.ITEMS = " + JSON.stringify(items, null, 2) + ";\n"
);

const soldCount = items.filter((i) => i.sold).length;
console.log("Done. " + (items.length - soldCount) + " for sale, " + soldCount + " sold.");
