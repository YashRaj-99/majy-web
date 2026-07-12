const logo = document.querySelector(".logo");

if (logo) {
    let logoClicks = 0;
    let resetTimer;
    let navigationTimer;

    logo.addEventListener("click", (event) => {
        event.preventDefault();

        logoClicks++;

        clearTimeout(resetTimer);
        clearTimeout(navigationTimer);

        if (logoClicks >= 5) {
            window.location.href = "/games/skyline/";
            return;
        }

        resetTimer = setTimeout(() => {
            logoClicks = 0;
        }, 2000);

        navigationTimer = setTimeout(() => {
            if (logoClicks === 1) {
                window.location.href = "/";
            }
        }, 400);
    });
}
