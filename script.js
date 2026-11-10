(function () {
  "use strict";

  const site = window.SITE || {};
  const items = window.ITEMS || [];
  const available = items.filter((i) => !i.sold);
  const sold = items.filter((i) => i.sold);

  const dialog = document.getElementById("offer");
  const offerImg = document.getElementById("offer-img");
  const offerThumbs = document.getElementById("offer-thumbs");
  const offerItem = document.getElementById("offer-item");
  const offerEmail = document.getElementById("offer-email");
  const offerWa = document.getElementById("offer-wa");
  const offerEmailText = document.getElementById("offer-email-text");
  const offerCopy = document.getElementById("offer-copy");
  const offerCopied = document.getElementById("offer-copied");
  const offerPrice = document.getElementById("offer-price");
  const offerDetails = document.getElementById("offer-details");
  const offerBody = document.querySelector(".offer-body");
  let copiedTimer;

  function emailLink(subject, body) {
    return "mailto:" + site.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function waLink(text) {
    return "https://wa.me/" + site.whatsapp + "?text=" + encodeURIComponent(text);
  }

  // Copies text. The clipboard API only works on secure (https) pages, so fall back to the old method.
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      /* fall through to the fallback */
    }
    // The pop-up makes everything outside it unclickable, so the helper field must live inside it.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    dialog.append(field);
    field.select();
    field.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    field.remove();
    return ok;
  }

  function resetCopied() {
    clearTimeout(copiedTimer);
    offerCopy.classList.remove("done");
    offerCopied.textContent = "";
  }

  offerCopy.addEventListener("click", async () => {
    const ok = await copyText(site.email);
    resetCopied();
    offerCopied.textContent = ok ? "Email address copied" : "Could not copy. Press and hold the address to copy it.";
    if (ok) offerCopy.classList.add("done");
    copiedTimer = setTimeout(resetCopied, 3000);
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeTile(item) {
    const tile = el(item.sold ? "div" : "button", "tile" + (item.sold ? " sold" : ""));
    if (!item.sold) {
      tile.type = "button";
      tile.addEventListener("click", () => openOffer(item));
    }

    const cover = item.photos[0];
    const media = el("span", "media");
    const img = new Image();
    img.src = cover.thumb;
    img.alt = ""; // the caption below carries the name
    img.loading = "lazy";
    img.decoding = "async";
    if (cover.w && cover.h) {
      img.width = cover.w;
      img.height = cover.h;
    }
    media.append(img);

    if (item.photos.length > 1) {
      media.append(el("span", "badge", item.photos.length + " photos"));
    }

    if (item.sold) {
      const stamp = el("span", "stamp");
      stamp.setAttribute("aria-hidden", "true");
      stamp.append(el("span", "", "Sold"));
      media.append(stamp);
    }

    const cap = el("span", "cap");
    const text = el("span", "cap-text");
    text.append(el("span", "cap-title", item.title));
    if (item.price && !item.sold) text.append(el("span", "cap-price", "Asking " + item.price));
    cap.append(text);
    cap.append(el("span", "cap-cta", item.sold ? "Sold" : "Make an offer →"));

    tile.append(media, cap);
    return tile;
  }

  // A description is a list of blocks: plain text is a paragraph, {title, items} is a heading and a list.
  function renderDetails(blocks) {
    offerDetails.replaceChildren();
    (blocks || []).forEach((block) => {
      if (typeof block === "string") {
        offerDetails.append(el("p", "", block));
        return;
      }
      if (block.title) offerDetails.append(el("h3", "", block.title));
      const list = el("ul");
      (block.items || []).forEach((text) => list.append(el("li", "", text)));
      offerDetails.append(list);
    });
    offerDetails.hidden = !offerDetails.childNodes.length;
  }

  function showPhoto(item, index) {
    const photo = item.photos[index];
    offerImg.src = photo.full;
    offerImg.alt = item.title + (photo.label ? " (" + photo.label.toLowerCase() + ")" : "");
    Array.from(offerThumbs.children).forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === index));
    });
  }

  function openOffer(item) {
    offerThumbs.replaceChildren();
    item.photos.forEach((photo, index) => {
      const button = el("button", "thumb");
      button.type = "button";
      button.setAttribute("aria-label", photo.label || "Photo " + (index + 1));
      const thumb = new Image();
      thumb.src = photo.thumb;
      thumb.alt = "";
      button.append(thumb, el("span", "", photo.label || String(index + 1)));
      button.addEventListener("click", () => showPhoto(item, index));
      offerThumbs.append(button);
    });
    offerThumbs.hidden = item.photos.length < 2;
    showPhoto(item, 0);
    offerItem.textContent = item.title;

    resetCopied();
    offerEmailText.textContent = site.email;
    offerEmail.setAttribute("aria-label", "Email your offer to " + site.email);
    offerEmail.href = emailLink(
      "Offer for " + item.title,
      "Hi, I would like to make an offer for the " + item.title + ".\n\nMy offer: \n\nMy name: \n"
    );
    offerWa.href = waLink("Hi, I would like to make an offer for the " + item.title + ". My offer is: ");

    offerPrice.hidden = !item.price;
    offerPrice.textContent = item.price ? "Asking " + item.price : "";
    renderDetails(item.description);
    offerBody.scrollTop = 0;

    dialog.showModal();
    history.replaceState(null, "", "#" + item.id);
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // click on the dark backdrop
  });
  document.getElementById("offer-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  // Render
  const roomsEl = document.getElementById("rooms");
  const roomNav = document.getElementById("room-nav");
  const featured = document.getElementById("featured");
  const ROOM_ORDER = ["Kitchen", "Living room", "Bedroom"];

  // Group the available items by room. Rooms not in ROOM_ORDER follow it, and items with no room go last.
  const byRoom = new Map();
  available.forEach((item) => {
    if (item.last) {
      featured.append(makeTile(item));
      return;
    }
    const room = item.room || "More";
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push(item);
  });
  const rank = (room) => (ROOM_ORDER.includes(room) ? ROOM_ORDER.indexOf(room) : room === "More" ? 999 : 100);
  const rooms = [...byRoom.keys()].sort((a, b) => rank(a) - rank(b));

  rooms.forEach((room) => {
    const id = "room-" + room.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const section = document.createElement("section");
    section.className = "room";
    section.id = id;
    section.setAttribute("aria-labelledby", id + "-title");
    const heading = document.createElement("h3");
    heading.className = "room-title";
    heading.id = id + "-title";
    heading.textContent = room;
    const grid = document.createElement("div");
    grid.className = "grid";
    byRoom.get(room).forEach((item) => grid.append(makeTile(item)));
    section.append(heading, grid);
    roomsEl.append(section);

    if (rooms.length > 1) {
      const link = document.createElement("a");
      link.href = "#" + id;
      link.textContent = room;
      roomNav.append(link);
    }
  });
  roomNav.hidden = rooms.length < 2;
  document.getElementById("count").textContent =
    available.length === 1 ? "1 item" : available.length + " items";
  if (!available.length) {
    document.getElementById("empty").hidden = false;
    document.getElementById("count").hidden = true;
  }

  if (sold.length) {
    const soldGrid = document.getElementById("sold-grid");
    sold.forEach((item) => soldGrid.append(makeTile(item)));
    document.getElementById("sold-section").hidden = false;
  }

  // Footer contact links
  const footerEmail = document.getElementById("footer-email");
  footerEmail.href = emailLink("Question about your house sale", "");
  document.getElementById("footer-wa").href = waLink("Hi, I have a question about your house sale.");

  // A shared link like expathousesale.com/#oak-table opens that item straight away
  const wanted = decodeURIComponent(location.hash.slice(1));
  const target = available.find((i) => i.id === wanted);
  if (target) openOffer(target);
})();
