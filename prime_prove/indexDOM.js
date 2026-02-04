document.addEventListener("DOMContentLoaded", () => {
  const nome = document.querySelector("nome");
  const email = document.querySelector("email");

  console.log(nome);
  console.log(email);

  btn.addEventListener("click", () => {
    const nome = document.querySelector("#nome");
    const email = document.querySelector("#email");

    const nomeValue = nome.value;
    const emailValue = email.value;

    const isValid = formIsvalid(nameValue, emailValue);
    if (isValid) {
      console.log("Nome e email son validi");
    } else {
      console.log("nome e email non sono validi");
    }
  });
});
