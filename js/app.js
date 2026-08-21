(function(){
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var PRICE_PER_NIGHT = 800;
  var CONTACT_EMAIL = "mircea.george.vulcanescu@gmail.com";
  var CALENDAR_ID = "ch4cifvuu7agfajplgrccculheveu7g6@import.calendar.google.com";
  var ICS_URL = "https://calendar.google.com/calendar/ical/" + encodeURIComponent(CALENDAR_ID) + "/public/basic.ics";
  var PROXY_URLS = [
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(ICS_URL),
    "https://corsproxy.io/?url=" + encodeURIComponent(ICS_URL),
    "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(ICS_URL)
  ];

  var bookedRanges = [];
  var calStatusEl = document.getElementById("calStatus");

  function parseICSDate(raw){
    raw = raw.trim();
    if(/^\d{8}$/.test(raw)){
      var y=+raw.slice(0,4), m=+raw.slice(4,6)-1, d=+raw.slice(6,8);
      return new Date(y,m,d);
    }
    var m2 = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if(m2){
      return new Date(Date.UTC(+m2[1], +m2[2]-1, +m2[3], +m2[4], +m2[5], +m2[6]));
    }
    return null;
  }

  function parseICS(text){
    var lines = text.split(/\r\n|\n|\r/);
    var unfolded = [];
    for(var i=0;i<lines.length;i++){
      if(lines[i].charAt(0) === " " && unfolded.length){
        unfolded[unfolded.length-1] += lines[i].slice(1);
      } else {
        unfolded.push(lines[i]);
      }
    }
    var ranges = [];
    var cur = null;
    for(var j=0;j<unfolded.length;j++){
      var line = unfolded[j];
      if(line.indexOf("BEGIN:VEVENT") === 0){ cur = {}; continue; }
      if(line.indexOf("END:VEVENT") === 0){
        if(cur && cur.start && cur.end){ ranges.push({start:cur.start, end:cur.end}); }
        cur = null; continue;
      }
      if(!cur) continue;
      if(line.indexOf("DTSTART") === 0){
        var vs = line.split(":"); cur.start = parseICSDate(vs[vs.length-1]);
      } else if(line.indexOf("DTEND") === 0){
        var ve = line.split(":"); cur.end = parseICSDate(ve[ve.length-1]);
      }
    }
    return ranges;
  }

  function setStatus(msg, isError){
    calStatusEl.innerHTML = '<span class="dot"></span> ' + msg;
    calStatusEl.className = "cal-status" + (isError ? " error" : "");
  }

  function loadCalendar(){
    tryProxy(0);
  }

  function tryProxy(index){
    if(index >= PROXY_URLS.length){
      setStatus("Nu am putut sincroniza automat calendarul Google chiar acum. Poți totuși trimite o solicitare — disponibilitatea va fi confirmată manual prin email.", true);
      renderCalendar();
      return;
    }
    fetch(PROXY_URLS[index], {cache:"no-store"})
      .then(function(res){
        if(!res.ok) throw new Error("network");
        return res.text();
      })
      .then(function(text){
        if(text.indexOf("BEGIN:VCALENDAR") === -1) throw new Error("format");
        bookedRanges = parseICS(text);
        setStatus("Calendar sincronizat — disponibilitatea este la zi.", false);
        renderCalendar();
      })
      .catch(function(){
        tryProxy(index + 1);
      });
  }

  function isDateBooked(date){
    for(var i=0;i<bookedRanges.length;i++){
      var r = bookedRanges[i];
      if(date >= stripTime(r.start) && date < stripTime(r.end)) return true;
    }
    return false;
  }

  function stripTime(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  var today = stripTime(new Date());
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();
  var selection = { checkin:null, checkout:null };
  var MONTH_NAMES = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
  var DOW = ["L","Ma","Mi","J","V","S","D"];

  function setMinDates(){
    var min = toInputValue(today);
    ["quickCheckin","quickCheckout","fcheckin","fcheckout"].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.min = min;
    });
  }

  function buildMonthEl(year, month){
    var wrap = document.createElement("div");
    wrap.className = "cal-month";
    var h4 = document.createElement("h4");
    h4.textContent = MONTH_NAMES[month] + " " + year;
    wrap.appendChild(h4);

    var grid = document.createElement("div");
    grid.className = "cal-grid";
    DOW.forEach(function(d){
      var el = document.createElement("div");
      el.className = "dow"; el.textContent = d;
      grid.appendChild(el);
    });

    var firstDay = new Date(year, month, 1);
    var startOffset = (firstDay.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month+1, 0).getDate();

    for(var i=0;i<startOffset;i++){
      var empty = document.createElement("div");
      empty.className = "cal-day empty";
      grid.appendChild(empty);
    }

    for(var d2=1; d2<=daysInMonth; d2++){
      var date = new Date(year, month, d2);
      var cell = document.createElement("div");
      cell.className = "cal-day";
      cell.textContent = d2;

      var past = date < today;
      var booked = isDateBooked(date);

      if(past){
        cell.classList.add("past");
      } else if(booked){
        cell.classList.add("booked");
      } else {
        cell.classList.add("available");
        cell.addEventListener("click", function(dt){
          return function(){ handleDayClick(dt); };
        }(date));
      }

      if(selection.checkin && sameDay(date, selection.checkin)) cell.classList.add("selected");
      if(selection.checkout && sameDay(date, selection.checkout)) cell.classList.add("selected");
      if(selection.checkin && selection.checkout && date > selection.checkin && date < selection.checkout){
        cell.classList.add("in-range");
      }

      grid.appendChild(cell);
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

  function renderCalendar(){
    var host = document.getElementById("calMonths");
    host.innerHTML = "";
    host.appendChild(buildMonthEl(viewYear, viewMonth));
    var nextM = viewMonth+1, nextY = viewYear;
    if(nextM > 11){ nextM = 0; nextY++; }
    host.appendChild(buildMonthEl(nextY, nextM));
  }

  function hasBookedBetween(a,b){
    var d = new Date(a);
    while(d < b){
      if(isDateBooked(d)) return true;
      d.setDate(d.getDate()+1);
    }
    return false;
  }

  function handleDayClick(date){
    if(!selection.checkin || (selection.checkin && selection.checkout)){
      selection.checkin = date; selection.checkout = null;
    } else {
      if(date <= selection.checkin){
        selection.checkin = date; selection.checkout = null;
      } else if(hasBookedBetween(selection.checkin, date)){
        selection.checkin = date; selection.checkout = null;
      } else {
        selection.checkout = date;
      }
    }
    syncFormFromSelection();
    renderCalendar();
  }

  document.getElementById("calPrev").addEventListener("click", function(){
    viewMonth--; if(viewMonth<0){ viewMonth=11; viewYear--; }
    renderCalendar();
  });
  document.getElementById("calNext").addEventListener("click", function(){
    viewMonth++; if(viewMonth>11){ viewMonth=0; viewYear++; }
    renderCalendar();
  });

  var inCheckin = document.getElementById("fcheckin");
  var inCheckout = document.getElementById("fcheckout");
  var inGuests = document.getElementById("fguests");
  var quickCheckin = document.getElementById("quickCheckin");
  var quickCheckout = document.getElementById("quickCheckout");
  var quickGuests = document.getElementById("quickGuests");
  var summaryBody = document.getElementById("summaryBody");
  var rangeHint = document.getElementById("rangeHint");
  var lastMailto = "";

  function fmtDate(d){
    return d.toLocaleDateString("ro-RO", { day:"2-digit", month:"short", year:"numeric" });
  }
  function toInputValue(d){
    var mm = (d.getMonth()+1+"").padStart(2,"0");
    var dd = (d.getDate()+"").padStart(2,"0");
    return d.getFullYear()+"-"+mm+"-"+dd;
  }

  function nightsCount(ci, co){
    return Math.round((co - ci) / 86400000);
  }

  function syncFormFromSelection(){
    if(selection.checkin) inCheckin.value = toInputValue(selection.checkin);
    if(selection.checkout) inCheckout.value = toInputValue(selection.checkout);
    if(selection.checkin) quickCheckin.value = toInputValue(selection.checkin);
    if(selection.checkout) quickCheckout.value = toInputValue(selection.checkout);
    updateSummary();
  }

  function currentGuests(){
    return inGuests.value || "2";
  }

  function updateSummary(){
    var ci = inCheckin.value ? new Date(inCheckin.value + "T00:00:00") : null;
    var co = inCheckout.value ? new Date(inCheckout.value + "T00:00:00") : null;
    var guests = currentGuests();

    if(!ci || !co || co <= ci){
      summaryBody.innerHTML = '<p class="summary-empty">Alege datele de check-in și check-out pentru a vedea prețul total.</p>';
      rangeHint.textContent = "Selectează datele fie mai sus, fie direct din calendarul de disponibilitate.";
      rangeHint.style.color = "";
      return;
    }

    var nights = nightsCount(ci, co);
    var conflict = hasBookedBetween(ci, co);
    var total = nights * PRICE_PER_NIGHT;
    summaryBody.innerHTML =
      '<div class="summary-row"><span>Check-in</span><span>' + fmtDate(ci) + '</span></div>' +
      '<div class="summary-row"><span>Check-out</span><span>' + fmtDate(co) + '</span></div>' +
      '<div class="summary-row"><span>Oaspeți</span><span>' + guests + '</span></div>' +
      '<div class="summary-row"><span>' + nights + ' nopți × 800 RON</span><span>' + total + ' RON</span></div>' +
      '<div class="summary-row total"><span>Total</span><span>' + total + ' RON</span></div>';

    if(conflict){
      rangeHint.textContent = "Atenție: intervalul selectat include zile deja ocupate. Alege alte date.";
      rangeHint.style.color = "var(--red)";
    } else {
      rangeHint.textContent = nights + " nopți · " + guests + " oaspeți — total " + total + " RON.";
      rangeHint.style.color = "var(--green)";
    }
  }

  function applyDateInputs(sourceIn, sourceOut){
    if(sourceIn.value) inCheckin.value = sourceIn.value;
    if(sourceOut.value) inCheckout.value = sourceOut.value;
    selection.checkin = inCheckin.value ? new Date(inCheckin.value+"T00:00:00") : null;
    selection.checkout = inCheckout.value ? new Date(inCheckout.value+"T00:00:00") : null;
    quickCheckin.value = inCheckin.value;
    quickCheckout.value = inCheckout.value;
    updateSummary(); renderCalendar();
  }

  inCheckin.addEventListener("change", function(){ applyDateInputs(inCheckin, inCheckout); });
  inCheckout.addEventListener("change", function(){ applyDateInputs(inCheckin, inCheckout); });
  inGuests.addEventListener("change", function(){
    quickGuests.value = inGuests.value;
    updateSummary();
  });
  quickGuests.addEventListener("change", function(){
    inGuests.value = quickGuests.value;
    updateSummary();
  });

  document.getElementById("quickCheckBtn").addEventListener("click", function(){
    inGuests.value = quickGuests.value;
    applyDateInputs(quickCheckin, quickCheckout);
    document.getElementById("rezervare").scrollIntoView({behavior:"smooth"});
  });

  var confirmOverlay = document.getElementById("confirmOverlay");
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");

  function openOverlay(el){ el.classList.add("open"); }
  function closeOverlay(el){ el.classList.remove("open"); }

  document.querySelectorAll("[data-gallery]").forEach(function(btn){
    btn.addEventListener("click", function(){
      lightboxImg.src = btn.getAttribute("data-src");
      lightboxImg.alt = btn.getAttribute("data-caption") || "";
      openOverlay(lightbox);
    });
  });
  document.getElementById("lightboxClose").addEventListener("click", function(){ closeOverlay(lightbox); });
  lightbox.addEventListener("click", function(e){
    if(e.target === lightbox) closeOverlay(lightbox);
  });
  document.getElementById("confirmLater").addEventListener("click", function(){ closeOverlay(confirmOverlay); });
  document.getElementById("confirmSend").addEventListener("click", function(){
    if(lastMailto) window.location.href = lastMailto;
  });

  document.getElementById("bookingForm").addEventListener("submit", function(e){
    e.preventDefault();
    var name = document.getElementById("fname").value.trim();
    var phone = document.getElementById("fphone").value.trim();
    var email = document.getElementById("femail").value.trim();
    var guests = currentGuests();
    var ci = inCheckin.value, co = inCheckout.value;
    var msgEl = document.getElementById("formMsg");

    if(!name || !phone || !email || !ci || !co){
      msgEl.textContent = "Completează toate câmpurile pentru a trimite solicitarea.";
      msgEl.className = "form-msg show warn";
      return;
    }
    var ciDate = new Date(ci+"T00:00:00"), coDate = new Date(co+"T00:00:00");
    if(coDate <= ciDate){
      msgEl.textContent = "Data de check-out trebuie să fie după data de check-in.";
      msgEl.className = "form-msg show warn";
      return;
    }
    if(hasBookedBetween(ciDate, coDate)){
      msgEl.textContent = "Intervalul selectat include zile deja ocupate. Te rugăm alege alte date.";
      msgEl.className = "form-msg show warn";
      return;
    }

    var nights = nightsCount(ciDate, coDate);
    var total = nights * PRICE_PER_NIGHT;
    var subject = "Solicitare rezervare A13 Travel Concept — " + ci + " → " + co;
    var body =
      "Solicitare nouă de rezervare — A13 Travel Concept (Silver Mountain, Poiana Brașov)\n\n" +
      "Nume: " + name + "\n" +
      "Telefon: " + phone + "\n" +
      "Email: " + email + "\n" +
      "Oaspeți: " + guests + "\n\n" +
      "Check-in: " + ci + "\n" +
      "Check-out: " + co + "\n" +
      "Nopți: " + nights + "\n" +
      "Preț/noapte: " + PRICE_PER_NIGHT + " RON\n" +
      "Total: " + total + " RON\n";

    lastMailto = "mailto:" + CONTACT_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    document.getElementById("confirmText").textContent =
      name + " · " + nights + " nopți · " + guests + " oaspeți · " + total + " RON";
    openOverlay(confirmOverlay);

    msgEl.textContent = "Solicitarea este pregătită. Deschide emailul pentru a o trimite către " + CONTACT_EMAIL + ".";
    msgEl.className = "form-msg show ok";
  });

  var menuToggle = document.getElementById("menuToggle");
  var mobileNav = document.getElementById("mobileNav");
  menuToggle.addEventListener("click", function(){
    var open = mobileNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(e){
      var id = a.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if(target){
        e.preventDefault();
        mobileNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        target.scrollIntoView({behavior:"smooth", block:"start"});
      }
    }, true);
  });

  setMinDates();
  loadCalendar();
})();
