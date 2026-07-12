const logo = document.querySelector(".logo");

if (logo) {
    let logoClicks = 0;
    let resetTimer;

    logo.addEventListener("click", (event) => {
        event.preventDefault();

        logoClicks++;

        clearTimeout(resetTimer);

        if (logoClicks >= 5) {
            logoClicks = 0;
            window.location.assign("/games/skyline/");
            return;
        }

        resetTimer = setTimeout(() => {
            logoClicks = 0;
        }, 3000);
    });
}
