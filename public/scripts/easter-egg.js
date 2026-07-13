const logo = document.querySelector(".logo");

if (logo) {
    const REQUIRED_CLICKS = 5;
    const RESET_DELAY = 3000;

    let logoClicks = 0;
    let resetTimer;

    const toast = document.createElement("div");
    toast.className = "easter-egg-toast";

    document.body.appendChild(toast);

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("visible");
    }

    function hideToast() {
        toast.classList.remove("visible");
    }

    function resetClicks() {
        logoClicks = 0;
        hideToast();
    }

    logo.addEventListener("click", (event) => {
        event.preventDefault();

        logoClicks++;

        clearTimeout(resetTimer);

        const remainingClicks = REQUIRED_CLICKS - logoClicks;

        if (remainingClicks <= 0) {
            showToast("Project unlocked. Entering construction site...");

            setTimeout(() => {
                window.location.assign("/games/skyline/");
            }, 600);

            return;
        }

        showToast(
            `${remainingClicks} more ${
                remainingClicks === 1 ? "click" : "clicks"
            } to uncover something 👀`
        );

        resetTimer = setTimeout(
            resetClicks,
            RESET_DELAY
        );
    });
}
