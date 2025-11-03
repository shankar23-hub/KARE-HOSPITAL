/* script.js — shared logic for all pages (localStorage state, renderers, modals, CRUD) */
(function(){
  // Utilities
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const uid = (p='id') => p + Math.random().toString(36).slice(2,9);

  // Shared state (persisted)
  const defaultState = {
    patients: [],
    doctors: [],
    appts: [],
    billing: [],
    inventory: [],
    settings: { name: 'HealCare Clinic', currency: 'INR' }
  };

  function loadState(){
    const raw = localStorage.getItem('hc_state');
    if(!raw) { localStorage.setItem('hc_state', JSON.stringify(defaultState)); return JSON.parse(JSON.stringify(defaultState)); }
    try { return JSON.parse(raw); } catch { localStorage.setItem('hc_state', JSON.stringify(defaultState)); return JSON.parse(JSON.stringify(defaultState)); }
  }
  function saveState(){ localStorage.setItem('hc_state', JSON.stringify(state)); }

  let state = loadState();

  // Seed minimal data once
  function seed(){
    if(state.patients.length) return;
    state.patients = [
      { id: uid('p'), name: 'Ravi Kumar', phone: '9876543210', age: 36, sex: 'M' },
      { id: uid('p'), name: 'Meena Iyer', phone: '9123456780', age: 29, sex: 'F' }
    ];
    state.doctors = [
      { id: uid('d'), name: 'Dr. Ajay Nair', spec: 'Cardiology', phone: '9001112223' },
      { id: uid('d'), name: 'Dr. Sima Rao', spec: 'General Physician', phone: '9001113334' }
    ];
    state.appts = [
      { id: uid('a'), patientId: state.patients[0].id, doctorId: state.doctors[0].id, datetime: new Date(Date.now()+86400000).toISOString(), status: 'Scheduled' },
      { id: uid('a'), patientId: state.patients[1].id, doctorId: state.doctors[1].id, datetime: new Date().toISOString(), status: 'Completed' }
    ];
    state.billing = [{ id: uid('b'), patientId: state.patients[0].id, amount: 3200, date: new Date().toISOString(), status: 'Paid' }];
    state.inventory = [{ id: uid('i'), item: 'Paracetamol 500mg', qty: 120, expiry: '2026-02-01' }];
    saveState();
  }

  // Modal helpers
  function openModal(title, html, onSave){
    const backdrop = $('#modalBackdrop');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    backdrop.style.display = 'flex';
    $('#saveModal').onclick = function(){ if(typeof onSave === 'function') onSave(); closeModal(); };
  }
  function closeModal(){ $('#modalBackdrop').style.display = 'none'; }
  document.addEventListener('click', (e) => {
    if(e.target && e.target.id === 'modalBackdrop') closeModal();
  });
  // attach close
  document.addEventListener('DOMContentLoaded', function(){
    const btnClose = document.getElementById('closeModal');
    if(btnClose) btnClose.addEventListener('click', closeModal);
  });

  // Rendering helpers for tables
  function renderTable(tableSelector, rows, renderer){
    const tb = document.querySelector(tableSelector + ' tbody');
    if(!tb) return;
    tb.innerHTML = '';
    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = renderer(r, idx);
      tb.appendChild(tr);
    });
  }

  // Page-specific renderers (if elements exist, render)
  function renderStats(){
    const elPatients = document.getElementById('statPatients');
    if(elPatients) elPatients.textContent = state.patients.length;
    const elDoctors = document.getElementById('statDoctors');
    if(elDoctors) elDoctors.textContent = state.doctors.length;
    const elAppts = document.getElementById('statAppts');
    if(elAppts) elAppts.textContent = state.appts.filter(a => new Date(a.datetime) > new Date()).length;
  }

  function renderRecentAppts(){
    const box = document.getElementById('recentAppts');
    if(!box) return;
    box.innerHTML = '';
    const rows = state.appts.slice().sort((a,b)=> new Date(b.datetime)-new Date(a.datetime)).slice(0,6);
    if(!rows.length) { box.innerHTML = '<div class="small-muted">No appointments yet</div>'; return; }
    const t = document.createElement('table');
    t.innerHTML = '<thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach(r => {
      const p = state.patients.find(x => x.id === r.patientId) || {};
      const d = state.doctors.find(x => x.id === r.doctorId) || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name||'—'}</td><td>${d.name||'—'}</td><td>${new Date(r.datetime).toLocaleString()}</td><td>${r.status}</td>`;
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.appendChild(t);
  }

  function renderPatients(filter=''){
    const rows = state.patients.filter(p => (p.name + p.phone).toLowerCase().includes(filter.toLowerCase()));
    renderTable('#patientsTable', rows, (p, idx) => `<td>${idx+1}</td><td>${p.name}</td><td>${p.phone}</td><td>${p.age} / ${p.sex||'—'}</td><td><button class="btn ghost" onclick="editPatient('${p.id}')">Edit</button> <button class="btn" onclick="deletePatient('${p.id}')">Delete</button></td>`);
  }

  function renderDoctors(filter=''){
    const rows = state.doctors.filter(d => (d.name + d.spec + d.phone).toLowerCase().includes(filter.toLowerCase()));
    renderTable('#doctorsTable', rows, (d, idx) => `<td>${idx+1}</td><td>${d.name}</td><td>${d.spec}</td><td>${d.phone}</td><td><button class="btn ghost" onclick="editDoctor('${d.id}')">Edit</button> <button class="btn" onclick="deleteDoctor('${d.id}')">Delete</button></td>`);
    // populate doctor filter select if present
    const sel = document.getElementById('filterApptDoctor');
    if(sel){
      sel.innerHTML = '<option value="">All Doctors</option>';
      state.doctors.forEach(d => {
        const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.name} — ${d.spec}`; sel.appendChild(o);
      });
    }
  }

  function renderAppts(filterDoctor='', filterDate=''){
    let rows = state.appts.slice();
    if(filterDoctor) rows = rows.filter(a => a.doctorId === filterDoctor);
    if(filterDate) rows = rows.filter(a => new Date(a.datetime).toISOString().slice(0,10) === filterDate);
    renderTable('#apptsTable', rows, (a, idx) => {
      const p = state.patients.find(x => x.id === a.patientId) || {};
      const d = state.doctors.find(x => x.id === a.doctorId) || {};
      return `<td>${idx+1}</td><td>${p.name||'—'}</td><td>${d.name||'—'}</td><td>${new Date(a.datetime).toLocaleString()}</td><td>${a.status}</td><td><button class="btn ghost" onclick="editAppt('${a.id}')">Edit</button> <button class="btn" onclick="deleteAppt('${a.id}')">Delete</button></td>`;
    });
  }

  function renderBilling(){ renderTable('#billingTable', state.billing, (b, idx) => { const p = state.patients.find(x => x.id === b.patientId) || {}; return `<td>${idx+1}</td><td>${p.name||'—'}</td><td>${state.settings.currency} ${b.amount}</td><td>${new Date(b.date).toLocaleDateString()}</td><td>${b.status}</td>`; }); }

  function renderInventory(){ renderTable('#inventoryTable', state.inventory, (it, idx) => `<td>${idx+1}</td><td>${it.item}</td><td>${it.qty}</td><td>${it.expiry||'—'}</td><td><button class="btn ghost" onclick="editStock('${it.id}')">Edit</button> <button class="btn" onclick="deleteStock('${it.id}')">Delete</button></td>`); }

  function renderPatientProfiles(filter=''){
    const profiles = JSON.parse(localStorage.getItem('patientProfiles')||'[]');
    const rows = profiles.filter(p => {
      const q = (filter||'').toLowerCase();
      return !q || ( (p.name||'').toLowerCase().includes(q) || (p.mobile||'').includes(q) || (p.district||'').toLowerCase().includes(q) );
    });
    renderTable('#profilesTable', rows, (p, idx) => `<td>${idx+1}</td><td>${p.name||'—'}</td><td>${p.mobile||'—'}</td><td>${p.dob||'—'}</td><td>${p.gender||'—'}</td><td>${(p.district||'')}${p.city?'/'+p.city:''}</td><td>${p.email||'—'}</td><td>${p.blood||'—'}</td>`);
  }

  function renderFeedbacks(){
    const fb = JSON.parse(localStorage.getItem('feedbacks')||'[]');
    const tb = document.querySelector('#fbTable tbody');
    if(!tb) return;
    tb.innerHTML = '';
    if(!fb.length){ tb.innerHTML = '<tr><td colspan="5">No feedback yet</td></tr>'; return; }
    fb.forEach((f, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx+1}</td><td>${f.user||'—'}</td><td>${f.text}</td><td>${f.date||''}</td><td><button class="btn ghost" onclick="deleteFeedback(${idx})">Remove</button></td>`;
      tb.appendChild(tr);
    });
  }

  // Expose some functions globally for HTML onclick handlers (CRUD)
  window.newPatient = function(){
    openModal('New Patient', `<div class="grid-2"><div><label>Name</label><input id="m_name"/></div><div><label>Phone</label><input id="m_phone"/></div></div><div class="grid-2"><div><label>Age</label><input id="m_age" type="number"/></div><div><label>Sex</label><select id="m_sex"><option>F</option><option>M</option><option>Other</option></select></div></div>`, () => {
      const p = { id: uid('p'), name: $('#m_name').value || 'Unknown', phone: $('#m_phone').value || '', age: +$('#m_age').value || 0, sex: $('#m_sex').value || '' };
      state.patients.push(p); saveState(); renderPatients(); renderStats();
    });
  };

  window.editPatient = function(id){
    const p = state.patients.find(x => x.id === id); if(!p) return;
    openModal('Edit Patient', `<div class="grid-2"><div><label>Name</label><input id="m_name" value="${p.name||''}"/></div><div><label>Phone</label><input id="m_phone" value="${p.phone||''}"/></div></div><div class="grid-2"><div><label>Age</label><input id="m_age" type="number" value="${p.age||0}"/></div><div><label>Sex</label><select id="m_sex"><option ${p.sex==='F'?'selected':''}>F</option><option ${p.sex==='M'?'selected':''}>M</option><option ${p.sex==='Other'?'selected':''}>Other</option></select></div></div>`, () => {
      p.name = $('#m_name').value; p.phone = $('#m_phone').value; p.age = +$('#m_age').value; p.sex = $('#m_sex').value; saveState(); renderPatients(); renderStats();
    });
  };

  window.deletePatient = function(id){
    if(!confirm('Delete patient?')) return;
    state.patients = state.patients.filter(x=>x.id !== id);
    state.appts = state.appts.filter(a=> a.patientId !== id);
    state.billing = state.billing.filter(b=> b.patientId !== id);
    saveState(); renderPatients(); renderAppts(); renderBilling(); renderStats();
  };

  // Doctors
  window.newDoctor = function(){
    openModal('New Doctor', `<div class="grid-2"><div><label>Name</label><input id="d_name"/></div><div><label>Spec</label><input id="d_spec"/></div></div><div class="grid-2"><div><label>Phone</label><input id="d_phone"/></div><div></div></div>`, () => {
      const d = { id: uid('d'), name: $('#d_name').value || 'Dr. Unknown', spec: $('#d_spec').value || 'General', phone: $('#d_phone').value || '' };
      state.doctors.push(d); saveState(); renderDoctors(); renderStats();
    });
  };
  window.editDoctor = function(id){
    const d = state.doctors.find(x=> x.id === id); if(!d) return;
    openModal('Edit Doctor', `<div class="grid-2"><div><label>Name</label><input id="d_name" value="${d.name||''}"/></div><div><label>Spec</label><input id="d_spec" value="${d.spec||''}"/></div></div><div class="grid-2"><div><label>Phone</label><input id="d_phone" value="${d.phone||''}"/></div></div>`, () => {
      d.name = $('#d_name').value; d.spec = $('#d_spec').value; d.phone = $('#d_phone').value; saveState(); renderDoctors(); renderAppts();
    });
  };
  window.deleteDoctor = function(id){
    if(!confirm('Delete doctor?')) return;
    state.doctors = state.doctors.filter(x=> x.id !== id);
    state.appts = state.appts.filter(a=> a.doctorId !== id);
    saveState(); renderDoctors(); renderAppts(); renderStats();
  };

  // Appointments
  window.newAppt = function(){
    openModal('New Appointment', `<div class="grid-2"><div><label>Patient</label><select id="a_patient">${state.patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div><label>Doctor</label><select id="a_doctor">${state.doctors.map(d=>`<option value="${d.id}">${d.name} — ${d.spec}</option>`).join('')}</select></div></div><div class="grid-2"><div><label>Date</label><input id="a_dt" type="date" value="${new Date().toISOString().slice(0,10)}"/></div><div><label>Status</label><select id="a_status"><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></div></div>`, () => {
      const a = { id: uid('a'), patientId: $('#a_patient').value, doctorId: $('#a_doctor').value, datetime: new Date($('#a_dt').value).toISOString(), status: $('#a_status').value };
      state.appts.push(a); saveState(); renderAppts(); renderRecentAppts(); renderStats();
    });
  };

  window.editAppt = function(id){
    const a = state.appts.find(x=> x.id === id); if(!a) return;
    openModal('Edit Appointment', `<div class="grid-2"><div><label>Patient</label><select id="a_patient">${state.patients.map(p=>`<option value="${p.id}" ${p.id===a.patientId?'selected':''}>${p.name}</option>`).join('')}</select></div><div><label>Doctor</label><select id="a_doctor">${state.doctors.map(d=>`<option value="${d.id}" ${d.id===a.doctorId?'selected':''}>${d.name} — ${d.spec}</option>`).join('')}</select></div></div><div class="grid-2"><div><label>Date & Time</label><input id="a_dt" type="datetime-local" value="${new Date(a.datetime).toISOString().slice(0,16)}"/></div><div><label>Status</label><select id="a_status"><option ${a.status==='Scheduled'?'selected':''}>Scheduled</option><option ${a.status==='Completed'?'selected':''}>Completed</option><option ${a.status==='Cancelled'?'selected':''}>Cancelled</option></select></div></div>`, () => {
      a.patientId = $('#a_patient').value; a.doctorId = $('#a_doctor').value; a.datetime = new Date($('#a_dt').value).toISOString(); a.status = $('#a_status').value; saveState(); renderAppts(); renderRecentAppts();
    });
  };

  window.deleteAppt = function(id){
    if(!confirm('Delete appointment?')) return;
    state.appts = state.appts.filter(x=> x.id !== id); saveState(); renderAppts(); renderRecentAppts(); renderStats();
  };

  // Billing
  window.newInvoice = function(){
    openModal('New Invoice', `<div class="grid-2"><div><label>Patient</label><select id="b_patient">${state.patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div><div><label>Amount</label><input id="b_amount" type="number"/></div></div><div class="grid-2"><div><label>Date</label><input id="b_date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div><div><label>Status</label><select id="b_status"><option>Paid</option><option>Unpaid</option></select></div></div>`, () => {
      const b = { id: uid('b'), patientId: $('#b_patient').value, amount: +$('#b_amount').value || 0, date: new Date($('#b_date').value).toISOString(), status: $('#b_status').value };
      state.billing.push(b); saveState(); renderBilling();
    });
  };

  // Inventory
  window.newStock = function(){
    openModal('Add Stock', `<div><label>Item</label><input id="s_item"/></div><div class="grid-2"><div><label>Quantity</label><input id="s_qty" type="number"/></div><div><label>Expiry (optional)</label><input id="s_exp" type="date"/></div></div>`, () => {
      const it = { id: uid('i'), item: $('#s_item').value || 'Item', qty: +$('#s_qty').value || 0, expiry: $('#s_exp').value || '' };
      state.inventory.push(it); saveState(); renderInventory();
    });
  };
  window.editStock = function(id){
    const it = state.inventory.find(x=>x.id===id); if(!it) return;
    openModal('Edit Stock', `<div><label>Item</label><input id="s_item" value="${it.item||''}"/></div><div class="grid-2"><div><label>Quantity</label><input id="s_qty" type="number" value="${it.qty||0}"/></div><div><label>Expiry</label><input id="s_exp" type="date" value="${it.expiry||''}"/></div></div>`, () => {
      it.item = $('#s_item').value; it.qty = +$('#s_qty').value || 0; it.expiry = $('#s_exp').value; saveState(); renderInventory();
    });
  };
  window.deleteStock = function(id){
    if(!confirm('Delete stock item?')) return;
    state.inventory = state.inventory.filter(x=> x.id !== id); saveState(); renderInventory();
  };

  // Feedbacks
  window.deleteFeedback = function(index){
    if(!confirm('Remove feedback?')) return;
    let fb = JSON.parse(localStorage.getItem('feedbacks') || '[]');
    fb.splice(index,1); localStorage.setItem('feedbacks', JSON.stringify(fb)); renderFeedbacks();
  };

  // Settings
  function saveSettingsFromDOM(){
    const n = document.getElementById('settingName'); const c = document.getElementById('settingCurrency');
    if(n && c){ state.settings.name = n.value || state.settings.name; state.settings.currency = c.value || state.settings.currency; saveState(); alert('Settings saved'); }
  }

  // Quick UI wiring: search + navigation highlighting
  function wireNav(){
    document.querySelectorAll('.nav a').forEach(a => {
      a.addEventListener('click', (e) => {
        // for separate pages we let link navigate naturally; for anchors use JS
        // visually toggle active
        document.querySelectorAll('.nav a').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
      });
    });
  }

  // Init on DOM ready for each page
  document.addEventListener('DOMContentLoaded', function(){
    seed(); wireNav();

    // render common parts if present
    if(document.getElementById('todayDate')) document.getElementById('todayDate').textContent = new Date().toLocaleDateString();

    renderStats(); renderRecentAppts(); renderPatients(); renderDoctors(); renderAppts(); renderBilling(); renderInventory(); renderPatientProfiles(); renderFeedbacks();

    // wire page-specific DOM events (if elements exist)
    const filterPatient = document.getElementById('filterPatient'); if(filterPatient) filterPatient.addEventListener('input', e => renderPatients(e.target.value));
    const filterDoctor = document.getElementById('filterDoctor'); if(filterDoctor) filterDoctor.addEventListener('input', e => renderDoctors(e.target.value));
    const filterApptDoctor = document.getElementById('filterApptDoctor'); if(filterApptDoctor) filterApptDoctor.addEventListener('change', e => renderAppts(e.target.value, document.getElementById('filterApptDate') ? document.getElementById('filterApptDate').value : ''));
    const filterApptDate = document.getElementById('filterApptDate'); if(filterApptDate) filterApptDate.addEventListener('change', e => renderAppts(document.getElementById('filterApptDoctor') ? document.getElementById('filterApptDoctor').value : '', e.target.value));
    const filterProfile = document.getElementById('filterProfile'); if(filterProfile) filterProfile.addEventListener('input', e => renderPatientProfiles(e.target.value));

    // settings save button
    const saveSettingsBtn = document.getElementById('saveSettings'); if(saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettingsFromDOM);

    // add quick add
    const addQuick = document.getElementById('addQuickBtn'); if(addQuick) addQuick.addEventListener('click', () => {
      openModal('Quick Add', `<div class="grid-2"><div><label>Type</label><select id="quickType"><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="appt">Appointment</option></select></div><div></div></div>`, () => {
        const t = document.getElementById('quickType').value;
        if(t==='patient') window.newPatient();
        else if(t==='doctor') window.newDoctor();
        else window.newAppt();
      });
    });

    // global search
    const globalSearch = document.getElementById('globalSearch');
    if(globalSearch){
      globalSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const p = state.patients.filter(x => (x.name + x.phone).toLowerCase().includes(q));
        const d = state.doctors.filter(x => (x.name + x.spec).toLowerCase().includes(q));
        if(p.length){
          // navigate to patients page if separate pages: try to link
          const patientsLink = document.querySelector('.nav a[data-page="patients"]') || document.querySelector('.nav a[href*="Patients.html"]');
          if(patientsLink && patientsLink.href) window.location.href = patientsLink.href;
        } else if(d.length){
          const doctorsLink = document.querySelector('.nav a[data-page="doctors"]') || document.querySelector('.nav a[href*="doctors.html"]');
          if(doctorsLink && doctorsLink.href) window.location.href = doctorsLink.href;
        }
      });
    }
  });
  // ===== Background Slideshow for Login & CreateAccount =====
document.addEventListener('DOMContentLoaded', function(){
  const slides = document.querySelectorAll('.auth-bg img');
  if (!slides.length) return;
  let idx = 0;
  slides[idx].classList.add('active');
  setInterval(() => {
    slides[idx].classList.remove('active');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
  }, 4000);
});


  // Expose save and render helpers if needed
  window.save = saveState;
  window.renderStats = renderStats;
  window.renderRecentAppts = renderRecentAppts;
  window.renderPatients = renderPatients;
  window.renderDoctors = renderDoctors;
  window.renderAppts = renderAppts;
  window.renderBilling = renderBilling;
  window.renderInventory = renderInventory;
  window.renderPatientProfiles = renderPatientProfiles;
  window.renderFeedbacks = renderFeedbacks;
  window.openModal = openModal;
  window.closeModal = closeModal;

  // Show user name / avatar
      document.getElementById('loggedUser').textContent = user;
      document.getElementById('userAvatar').textContent = user.charAt(0).toUpperCase();

      // Logout function
      document.getElementById('logoutBtn').addEventListener('click', function(){
        if(confirm('Are you sure you want to logout?')){
          localStorage.removeItem('hc_logged_in');
          window.location.href = 'Login.html';
        }
      });

})();
