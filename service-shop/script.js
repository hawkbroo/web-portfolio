(function () {
  var STORAGE_KEY = "domservice_demo_cart_v1";

  function money(n) {
    return n.toLocaleString("ru-RU") + " ₽";
  }

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateBadges();
  }

  function cartCount(items) {
    return items.reduce(function (sum, it) {
      return sum + (it.qty || 0);
    }, 0);
  }

  function cartTotal(items) {
    return items.reduce(function (sum, it) {
      return sum + (it.price || 0) * (it.qty || 0);
    }, 0);
  }

  function updateBadges() {
    var count = cartCount(readCart());
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  function addItem(item) {
    var cart = readCart();
    var found = cart.find(function (x) {
      return x.id === item.id;
    });
    if (found) {
      found.qty += item.qty || 1;
    } else {
      cart.push({
        id: item.id,
        title: item.title,
        price: Number(item.price) || 0,
        qty: item.qty || 1,
      });
    }
    writeCart(cart);
    showToast("Добавлено в корзину: " + item.title + " (демо)");
  }

  function setQty(id, qty) {
    var cart = readCart()
      .map(function (it) {
        if (it.id !== id) return it;
        return Object.assign({}, it, { qty: qty });
      })
      .filter(function (it) {
        return it.qty > 0;
      });
    writeCart(cart);
    renderCartPage();
    renderOrderSummary();
  }

  function clearCart() {
    writeCart([]);
    renderCartPage();
    renderOrderSummary();
  }

  function showToast(text) {
    var toast = document.querySelector("#demo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "demo-toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("show");
    window.setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }

  function renderCartPage() {
    var root = document.querySelector("#cart-root");
    if (!root) return;
    var cart = readCart();
    if (!cart.length) {
      root.innerHTML =
        '<div class="card empty-cart">' +
        "<h2>Корзина пуста</h2>" +
        "<p class=\"muted\">Добавьте несколько наборов из каталога — это демо, оплата отключена.</p>" +
        '<p><a class="btn btn-primary" href="catalog.html">Перейти в каталог</a></p>' +
        "</div>";
      return;
    }

    var rows = cart
      .map(function (it) {
        return (
          '<tr data-id="' +
          it.id +
          '">' +
          "<td><strong>" +
          it.title +
          "</strong></td>" +
          "<td>" +
          money(it.price) +
          "</td>" +
          '<td><div class="qty">' +
          '<button type="button" class="qty-btn" data-act="dec" aria-label="Меньше">−</button>' +
          '<span class="qty-val">' +
          it.qty +
          "</span>" +
          '<button type="button" class="qty-btn" data-act="inc" aria-label="Больше">+</button>' +
          "</div></td>" +
          "<td><strong>" +
          money(it.price * it.qty) +
          "</strong></td>" +
          '<td><button type="button" class="linkish" data-act="rm">Убрать</button></td>' +
          "</tr>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="cart-table-wrap">' +
      "<table class=\"cart-table\">" +
      "<thead><tr><th>Товар</th><th>Цена</th><th>Кол-во</th><th>Сумма</th><th></th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table></div>" +
      '<div class="cart-footer">' +
      '<p class="notice" style="margin:0">Демо-корзина в браузере (localStorage). Заказ и оплата не настоящие.</p>' +
      '<div class="cart-actions">' +
      '<button type="button" class="btn btn-ghost" id="clear-cart">Очистить</button>' +
      "<div class=\"cart-total\">Итого: <strong>" +
      money(cartTotal(cart)) +
      "</strong> <span class=\"muted\">· к оплате сейчас 0 ₽</span></div>" +
      '<a class="btn btn-primary" href="order.html">Оформить доставку</a>' +
      "</div></div>";
  }

  function renderOrderSummary() {
    var list = document.querySelector("#order-items");
    var totalEl = document.querySelector("#order-total");
    var empty = document.querySelector("#order-empty");
    var form = document.querySelector("#order-form");
    if (!list || !totalEl) return;

    var cart = readCart();
    if (!cart.length) {
      list.innerHTML = "";
      totalEl.textContent = "0 ₽";
      if (empty) empty.hidden = false;
      if (form) {
        var btn = form.querySelector('[type="submit"]');
        if (btn) btn.disabled = true;
      }
      return;
    }
    if (empty) empty.hidden = true;
    if (form) {
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
    }

    list.innerHTML = cart
      .map(function (it) {
        return (
          "<li><span>" +
          it.title +
          " × " +
          it.qty +
          '</span><span>' +
          money(it.price * it.qty) +
          "</span></li>"
        );
      })
      .join("");
    totalEl.innerHTML = money(cartTotal(cart)) + ' <span class="muted" style="font-weight:500;font-size:0.85rem">→ оплата 0 ₽ (демо)</span>';
  }

  // nav mobile
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // add to cart buttons
  document.querySelectorAll("[data-add-cart]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addItem({
        id: btn.getAttribute("data-id"),
        title: btn.getAttribute("data-title"),
        price: Number(btn.getAttribute("data-price")),
        qty: 1,
      });
    });
  });

  // cart page events
  var cartRoot = document.querySelector("#cart-root");
  if (cartRoot) {
    cartRoot.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var row = btn.closest("tr[data-id]");
      if (!row) return;
      var id = row.getAttribute("data-id");
      var cart = readCart();
      var item = cart.find(function (x) {
        return x.id === id;
      });
      if (!item) return;
      var act = btn.getAttribute("data-act");
      if (act === "inc") setQty(id, item.qty + 1);
      if (act === "dec") setQty(id, item.qty - 1);
      if (act === "rm") setQty(id, 0);
    });
    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "clear-cart") {
        clearCart();
        showToast("Корзина очищена (демо)");
      }
    });
  }

  var orderForm = document.querySelector("#order-form");
  if (orderForm) {
    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!readCart().length) {
        showToast("Сначала добавьте товары в корзину");
        return;
      }
      showToast("Демо: заявка не отправлена, оплата отключена, корзина не списана.");
    });
  }

  document.querySelectorAll("[data-demo-pay]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
    });
  });

  updateBadges();
  renderCartPage();
  renderOrderSummary();
})();
