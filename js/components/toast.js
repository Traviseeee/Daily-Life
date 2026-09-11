const Toast = {
  show(message) {
    const stack = document.getElementById("toastStack");
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${Icons.check()}</strong> ${message}`;
    stack.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }
};
