(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var params = new URLSearchParams(window.location.search);
  var product = params.get("product");
  var productField = document.querySelector("#product");
  if (product && productField) {
    productField.value = product;
  }

  var orderForm = document.querySelector("#order-form");
  var toast = document.querySelector("#demo-toast");
  if (orderForm) {
    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (toast) {
        toast.classList.add("show");
        window.setTimeout(function () {
          toast.classList.remove("show");
        }, 4200);
      }
    });
  }

  document.querySelectorAll("[data-demo-pay]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
    });
  });
})();
