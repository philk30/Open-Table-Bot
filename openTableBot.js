// ==UserScript==
// @name         OpenTableBot
// @match        https://www.opentable.com/*
// @match        https://cdn.otstatic.com/maintenance/busy/index.html
// @version      0.1
// @description  get your reservation when others cancel
// @author       Nohren
// @grant        window.close
// @grant        GM.setValue
// @grant        GM.getValue
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  const minCheckTime = 45000;
  const maxCheckTime = 60000 * 2;

  async function sendEmail(message, href) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, href }),
    };
    try {
      const response = await fetch(
        "http://localhost:8080/reservation",
        options
      );
      !response.ok
        ? console.log("Email send failed")
        : console.log("Email send success!");
      const data = await response.json();
      console.log(data);
    } catch (e) {
      console.log("Failed to send data to server", e);
    }
  }

   function minAndSec(ms) {
     const val = ms / 1000 / 60
     const min = Math.floor(val)
     const sec = Math.round((val - min) * 60)
     return `${min} min and ${sec} seconds`
  }

  function startCheckingAgain() {
    const randomInterval = randomIntervalFunc();
    console.log(
      `checking again in ${minAndSec(randomInterval)}`
    );
    setTimeout(() => window.location.reload(), randomInterval);
  }

  function randomIntervalFunc() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // Check if we're within 10 minutes before or after noon (11:59 AM - 12:02 PM)
    const isNearNoon = (currentHour === 11 && currentMinute >= 50) ||
                       (currentHour === 12 && currentMinute <= 10);
    if (isNearNoon) {
        // Fast checks: every 5-10 seconds during release window
        return Math.floor(Math.random() * 5000) + 5000;
    } else {
        // Normal slow checks: 45s - 2min
        return Math.floor(Math.max(minCheckTime, Math.random() * maxCheckTime));
    }
  }

  //results are within 2.5 hrs of reservation
  async function checkForTimeSlots() {
    console.log("checking for time slots");
    let result;
    //wait for XHR to load
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const slots = document.querySelector("[data-test='time-slots']");
    for (const child of slots?.children ?? []) {
      if (child.firstChild.ariaLabel) {
        result = `Reservation found! - ${new Date()}`;
        const message = `Reservation available at ${child.firstChild.innerText}: ${child.firstChild.ariaLabel}`;
        sendEmail(message, child.firstChild.href);

        //attempt to reserve via bot
        child.firstChild.click();
      }
    }

    console.log(result ?? `no reservation found - ${new Date()}`);

    // check again in next interval if no result
    if (!result) {
       try {
        startCheckingAgain();
       } catch (error) {
        console.error("Error while restarting the check:", error);
       }
    }
  }

  async function completeReservation() {
    console.log("booking page - attempting to complete reservation");
    // Wait longer for page to load
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const completeReservationButton = document.querySelector(
      "[data-test='complete-reservation-button']"
    );
    if (completeReservationButton) {
      console.log("Button found! Clicking...");
      completeReservationButton.click();
      console.log("Button clicked successfully");
    } else {
      console.log("Complete reservation button not found!");
      console.log("Available buttons:", document.querySelectorAll("button"));
      // Send alert email
      sendEmail('Reached booking page but could not find complete button', window.location.href);
    }
}

 async function kickedOut(wait) {
    const url = await GM.getValue("url", null);
    if (!url) {
        console.log(`no url to back to ${url}`);
        sendEmail('Got kicked out, no url to go back to!', window.location.href)
        return
    }
    console.log(`got kicked out. Will try again in ${minAndSec(wait)}`)
    console.log(url)
    setTimeout(() => {
      window.location.assign(url)
    }, wait ?? 1000 * 60 * 5)
 }

 function execute(func) {
     //somtimes user script is injected after the page is loaded, and sometimes before.
     if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", func);
     } else {
          func();
     }
 }

  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.textAlign = "center";
  el.style.fontWeight = "bold";
  el.style.fontSize = "xx-large";
  el.innerText = "🤖 Agent Running";
  el.style.backgroundColor = "lime";

  switch (true) {
      case /\/r\/[a-zA-Z0-9-]+/.test(window.location.pathname) || !!document.querySelector("[data-testid='restaurant-banner-content-container']"):
          GM.setValue("url", window.location.href);
          console.log(`set url as ${window.location.href}`)
          execute(checkForTimeSlots)
          break
      case window.location.pathname === "/maintenance/busy/index.html":
          console.log('kicked out');
          execute(kickedOut)
          break
      case window.location.pathname === "/booking/details":
          execute(async () => {
        await completeReservation()
    })
          break
      default:
        console.log('default case');
        el.innerText = "🤖 Armed";
        el.style.backgroundColor = "yellow";
  }

  document.body.prepend(el);
})();