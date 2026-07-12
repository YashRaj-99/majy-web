const logo = document.querySelector(".logo");

if (logo) {
    let logoClicks = 0;
    let resetTimer;

    logo.addEventListener("click", (event) => {
        logoClicks++;

        clearTimeout(resetTimer);

        if (logoClicks >= 5) {
            event.preventDefault();
            window.location.href = "/games/skyline/";
            return;
        }

        resetTimer = setTimeout(() => {
            logoClicks = 0;
        }, 2000);
    });
}
