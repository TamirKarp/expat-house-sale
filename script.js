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

  function emailLink(subject, body) {
    return "mailto:" + site.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function waLink(text) {
    return "https://wa.me/" + site.whatsapp + "?text=" + encodeURIComponent(text);
  }

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
    cap.append(el("span", "cap-title", item.title));
    cap.append(el("span", "cap-cta", item.sold ? "Sold" : "Make an offer →"));

    tile.append(media, cap);
    return tile;
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

    offerEmail.href = emailLink(
      "Offer for " + item.title,
      "Hi, I would like to make an offer for: " + item.title + "\n\nMy offer: \n\nMy name: \n"
    );
    offerWa.href = waLink("Hi, I would like to make an offer for: " + item.title + ". My offer is: ");

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
  const grid = document.getElementById("grid");
  available.forEach((item) => grid.append(makeTile(item)));
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
  document.getElementById("footer-email").href = emailLink("Question about your house sale", "");
  document.getElementById("footer-wa").href = waLink("Hi, I have a question about your house sale.");

  // A shared link like expathousesale.com/#oak-table opens that item straight away
  const wanted = decodeURIComponent(location.hash.slice(1));
  const target = available.find((i) => i.id === wanted);
  if (target) openOffer(target);
})();
