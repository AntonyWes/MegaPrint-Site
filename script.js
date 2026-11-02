(() => {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ===== Scroll lock ===== */
  const locks = new Set();
  const lockScroll = (reason) => {
    locks.add(reason);
    document.body.classList.add("is-locked");
  };
  const unlockScroll = (reason) => {
    locks.delete(reason);
    if (!locks.size) document.body.classList.remove("is-locked");
  };

  /* ===== Header ===== */
  const header = $(".site-header");
  const updateHeader = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* ===== Random 5-star reviews ===== */
  const reviewPool = Array.isArray(window.MEGAPRINT_REVIEWS) ? window.MEGAPRINT_REVIEWS : [];

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character]));

  const renderRandomReviews = () => {
    const grid = $(".reviews-grid");
    if (!grid || reviewPool.length < 3) return;

    const shuffled = reviewPool.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    const cardStyles = ["review--ink", "review--pink", "review--cyan"];
    const star = '<svg class="icon icon--fill" aria-hidden="true"><use href="#i-star"/></svg>';

    grid.innerHTML = shuffled
      .slice(0, 3)
      .map(
        (review, index) => `
          <article class="review ${cardStyles[index]}" data-reveal style="--delay: ${index * 80}ms">
            <svg class="review__quote" aria-hidden="true"><use href="#i-quote"/></svg>
            <span class="stars" role="img" aria-label="Оценка 5 из 5">${star.repeat(5)}</span>
            <blockquote>${escapeHtml(review.text)}</blockquote>
            <footer><span>${escapeHtml(review.name)}</span><span>${escapeHtml(review.source)}</span></footer>
          </article>
        `
      )
      .join("");
  };

  renderRandomReviews();

  /* ===== Reveal on scroll ===== */
  const revealItems = $$("[data-reveal]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    revealItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.92) item.classList.add("will-reveal");
      observer.observe(item);
    });
  }

  /* ===== Open now (Europe/Minsk) ===== */
  const schedule = (day) => (day === 0 || day === 6 ? [600, 1080] : [480, 1200]);
  const formatTime = (minutes) => {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  };

  const updateOpenStatus = () => {
    const statusNodes = $$("[data-open-status]");
    const dots = $$("[data-status-dot]");
    if (!statusNodes.length) return;

    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Minsk",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
    } catch (error) {
      return;
    }

    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = weekdays[get("weekday")];
    let hour = Number(get("hour"));
    if (hour === 24) hour = 0;
    const minutes = hour * 60 + Number(get("minute"));
    if (Number.isNaN(day) || Number.isNaN(minutes)) return;

    const [open, close] = schedule(day);
    const isOpen = minutes >= open && minutes < close;
    let text;

    if (isOpen) {
      text = `Сейчас открыто · до ${formatTime(close)}`;
    } else {
      let nextDay = day;
      let offset = 0;

      if (minutes >= close) {
        for (let i = 1; i <= 7; i += 1) {
          const candidate = (day + i) % 7;
          const [candidateOpen] = schedule(candidate);
          if (candidateOpen) {
            nextDay = candidate;
            offset = i;
            break;
          }
        }
      }

      const [nextOpen] = schedule(nextDay);
      const dayLabel = offset === 0 ? "" : offset === 1 ? "завтра " : nextDay === 1 ? "в понедельник " : nextDay === 6 ? "в субботу " : nextDay === 0 ? "в воскресенье " : "";
      text = `Сейчас закрыто · откроемся ${dayLabel}в ${formatTime(nextOpen)}`;
    }

    statusNodes.forEach((node) => {
      node.textContent = text;
    });

    dots.forEach((dot) => {
      dot.classList.toggle("is-open", isOpen);
      dot.classList.toggle("is-closed", !isOpen);
    });
  };

  updateOpenStatus();
  window.setInterval(updateOpenStatus, 60 * 1000);

  /* ===== Mobile menu ===== */
  const mobileMenu = $("#mobile-menu");
  const menuBackdrop = $("[data-menu-backdrop]");
  const burger = $(".burger");
  const closeMenuBtn = $("[data-close-menu]");
  let menuOpen = false;
  let lastMenuFocus = null;

  const closeMenu = () => {
    if (!menuOpen) return;
    menuOpen = false;
    mobileMenu?.classList.remove("is-open");
    if (mobileMenu) mobileMenu.inert = true;
    burger?.classList.remove("is-active");
    burger?.setAttribute("aria-expanded", "false");
    if (menuBackdrop) {
      menuBackdrop.classList.remove("is-open");
      window.setTimeout(() => {
        if (menuBackdrop && !menuOpen) menuBackdrop.hidden = true;
      }, 320);
    }
    unlockScroll("menu");
    if (lastMenuFocus instanceof HTMLElement) lastMenuFocus.focus({ preventScroll: true });
  };

  const openMenu = () => {
    if (menuOpen) return;
    menuOpen = true;
    lastMenuFocus = document.activeElement;
    if (mobileMenu) mobileMenu.inert = false;
    if (menuBackdrop) menuBackdrop.hidden = false;
    window.requestAnimationFrame(() => {
      mobileMenu?.classList.add("is-open");
      menuBackdrop?.classList.add("is-open");
    });
    burger?.classList.add("is-active");
    burger?.setAttribute("aria-expanded", "true");
    lockScroll("menu");
    window.setTimeout(() => closeMenuBtn?.focus({ preventScroll: true }), 120);
  };

  burger?.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
  closeMenuBtn?.addEventListener("click", closeMenu);
  menuBackdrop?.addEventListener("click", closeMenu);
  $$(".mobile-menu a").forEach((link) => link.addEventListener("click", closeMenu));

  /* ===== Order modal ===== */
  const orderModal = $("#order-modal");
  const orderPanel = $(".modal__panel", orderModal);
  const orderForm = $("#order-form");
  const orderSuccess = $("#order-success");
  const orderService = $("#order-service");
  const orderCopyButton = $("[data-copy-order]");
  const orderResetButton = $("[data-reset-order]");
  let orderOpen = false;
  let lastOrderFocus = null;
  let orderText = "";

  const focusables = (container) =>
    $$(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter((element) => element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement);

  const trapFocus = (event, container) => {
    if (event.key !== "Tab") return;
    const items = focusables(container);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const resetOrder = () => {
    if (!orderForm || !orderSuccess) return;
    orderForm.reset();
    orderForm.hidden = false;
    orderSuccess.hidden = true;
    orderPanel?.classList.remove("is-success");
    if (orderService) orderService.value = "";
    orderText = "";
    window.setTimeout(() => {
      if (orderOpen) $("#order-name")?.focus({ preventScroll: true });
    }, 60);
  };

  const openOrder = (service) => {
    if (!orderModal || orderOpen) return;
    if (menuOpen) closeMenu();
    if (orderSuccess && !orderSuccess.hidden) resetOrder();
    lastOrderFocus = document.activeElement;
    orderOpen = true;
    orderPanel?.classList.remove("is-success");
    orderModal.hidden = false;
    window.requestAnimationFrame(() => orderModal.classList.add("is-open"));
    lockScroll("order");
    if (service && orderService) {
      orderService.value = service;
    }
    window.setTimeout(() => {
      const firstInput = $("#order-name");
      if (firstInput) firstInput.focus({ preventScroll: true });
      else $("button, input, select, textarea", orderPanel)?.focus({ preventScroll: true });
    }, 130);
  };

  const closeOrder = () => {
    if (!orderOpen || !orderModal) return;
    orderOpen = false;
    orderModal.classList.remove("is-open");
    unlockScroll("order");
    window.setTimeout(() => {
      if (!orderOpen) {
        orderModal.hidden = true;
        if (lastOrderFocus instanceof HTMLElement) lastOrderFocus.focus({ preventScroll: true });
      }
    }, 260);
  };

  $$("[data-open-order]").forEach((button) => {
    button.addEventListener("click", () => openOrder(button.dataset.service || ""));
  });
  $("[data-close-order]")?.addEventListener("click", closeOrder);
  orderModal?.addEventListener("click", (event) => {
    if (event.target === orderModal) closeOrder();
  });

  orderForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!orderForm.reportValidity()) return;

    const data = new FormData(orderForm);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const service = String(data.get("service") || "Не указана");
    const message = String(data.get("message") || "").trim();

    orderText = [
      "Заявка с сайта «МегаПринт»",
      "",
      `Имя: ${name}`,
      `Телефон / Telegram: ${phone}`,
      `Услуга: ${service}`,
      `Детали: ${message || "—"}`,
      "",
      `Дата: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Minsk" })}`,
    ].join("\n");

    const subject = `Заявка с сайта: ${service}`;
    const mailto = `mailto:m_odin@inbox.ru?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderText)}`;

    if (orderSuccess) {
      orderForm.hidden = true;
      orderSuccess.hidden = false;
      orderPanel?.classList.add("is-success");
      window.setTimeout(() => {
        if (orderOpen) $("h3", orderSuccess)?.focus({ preventScroll: true });
      }, 120);
    }

    window.setTimeout(() => {
      window.location.href = mailto;
    }, 80);
  });

  orderCopyButton?.addEventListener("click", async () => {
    if (!orderText) return;
    if (!orderCopyButton.dataset.originalHtml) {
      orderCopyButton.dataset.originalHtml = orderCopyButton.innerHTML;
    }
    const original = orderCopyButton.dataset.originalHtml;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(orderText);
      } else {
        const area = document.createElement("textarea");
        area.value = orderText;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      orderCopyButton.textContent = "Скопировано";
    } catch (error) {
      orderCopyButton.textContent = "Не получилось — выделите вручную";
    }
    window.setTimeout(() => {
      orderCopyButton.innerHTML = original;
    }, 2200);
  });

  orderResetButton?.addEventListener("click", resetOrder);

  /* ===== Privacy dialog ===== */
  const privacyDialog = $("#privacy-dialog");
  let privacyOpen = false;

  const openPrivacy = () => {
    if (!privacyDialog || privacyDialog.open || typeof privacyDialog.showModal !== "function") return;
    privacyOpen = true;
    privacyDialog.showModal();
    lockScroll("privacy");
  };

  const closePrivacy = () => {
    if (!privacyDialog) return;
    privacyDialog.close();
  };

  $$("[data-open-privacy]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPrivacy();
    });
  });
  $$("[data-close-privacy]").forEach((button) => button.addEventListener("click", closePrivacy));

  privacyDialog?.addEventListener("close", () => {
    privacyOpen = false;
    unlockScroll("privacy");
  });

  privacyDialog?.addEventListener("click", (event) => {
    if (event.target === privacyDialog) closePrivacy();
  });

  /* ===== Lightbox ===== */
  const lightbox = $("#lightbox");
  const lightboxImage = $("#lightbox-image");
  const lightboxCaption = $("#lightbox-caption");
  const lightboxClose = $("[data-lightbox-close]");
  const lightboxPrev = $("[data-lightbox-prev]");
  const lightboxNext = $("[data-lightbox-next]");
  const workButtons = $$(".work");
  let currentWork = 0;
  let lightboxOpen = false;

  const works = workButtons.map((button) => {
    const img = $("img", button);
    const captionParts = $$(".work__caption span", button).map((node) => node.textContent.trim());
    return {
      src: img?.getAttribute("src") || "",
      alt: img?.getAttribute("alt") || "",
      caption: captionParts.join(" · "),
    };
  });

  const renderWork = (index) => {
    if (!works.length || !lightboxImage || !lightboxCaption) return;
    currentWork = (index + works.length) % works.length;
    const work = works[currentWork];
    lightboxImage.src = work.src;
    lightboxImage.alt = work.alt;
    lightboxCaption.textContent = `${work.caption} · ${currentWork + 1} / ${works.length}`;
  };

  const openLightbox = (index) => {
    if (!lightbox || lightbox.open || typeof lightbox.showModal !== "function") return;
    renderWork(index);
    lightboxOpen = true;
    lightbox.showModal();
    lockScroll("lightbox");
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.close();
  };

  workButtons.forEach((button, index) => {
    button.addEventListener("click", () => openLightbox(Number(button.dataset.work) || index));
  });

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => renderWork(currentWork - 1));
  lightboxNext?.addEventListener("click", () => renderWork(currentWork + 1));

  lightbox?.addEventListener("close", () => {
    lightboxOpen = false;
    unlockScroll("lightbox");
  });

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  /* ===== Keyboard ===== */
  document.addEventListener("keydown", (event) => {
    if (lightboxOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      renderWork(currentWork + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }

    if (event.key === "Escape") {
      if (privacyOpen || lightboxOpen) return;
      if (menuOpen) {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (orderOpen) {
        event.preventDefault();
        closeOrder();
        return;
      }
    }

    if (privacyOpen || lightboxOpen) return;

    if (menuOpen && mobileMenu && event.key === "Tab") {
      trapFocus(event, mobileMenu);
      return;
    }

    if (orderOpen && orderPanel && event.key === "Tab") {
      trapFocus(event, orderPanel);
    }
  });

  /* ===== Resize cleanup ===== */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1020 && menuOpen) closeMenu();
  });

  /* ===== Footer year ===== */
  $$("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
