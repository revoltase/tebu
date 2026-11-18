const uang = new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0});
const angka = new Intl.NumberFormat("id-ID",{maximumFractionDigits:2});
function read(id, decimal = false) {
  const field = document.getElementById(id);
  const raw = field.value.trim();
  const pattern = decimal ? /^\d+(?:[.,]\d+)?$/ : /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;
  const value = Number(decimal ? raw.replace(",", ".") : raw.replaceAll(".", ""));
  const valid = pattern.test(raw) && value <= Number.MAX_SAFE_INTEGER;
  field.setAttribute("aria-invalid",String(!valid));
  return valid ? value : NaN;
}
function project(area, input) {
  const tons = area * input.yield;
  const revenue = tons * input.price;
  const grow = area * input.grow;
  const harvest = tons * input.haul;
  const rent = input.rent;
  const cost = grow + harvest + rent + input.other;
  const profit = revenue - cost;
  return {tons,revenue,grow,harvest,rent,other:input.other,cost,profit,breakEven:tons > 0 ? Math.ceil(cost / tons) : null};
}
const rows = [
  ["Produksi (ton)","tons"],["Penjualan","revenue"],["Borongan tanam baru / kepras","grow"],
  ["Tebang, muat, angkut","harvest"],["Sewa lahan","rent"],["Biaya tambahan","other"],
  ["Total biaya","cost"],["Surplus / defisit","profit"],["Surplus kumulatif","cumulative"],["Harga impas (Rp/ton)","breakEven"]
];
const annualFields = ["yield", "price", "haul", "other"];
const yearForms = document.getElementById("year-forms");
const resultYear = document.getElementById("result-year");
let yearCount = yearForms.children.length;

function yearLabel(index) {
  return index === 0 ? "Tanam baru" : "Keprasan " + index;
}

function resizeProjection(count) {
  const index = count - 1;
  if (count > yearForms.children.length) {
    const previous = yearForms.lastElementChild;
    const next = previous.cloneNode(true);
    next.open = false;
    next.hidden = false;
    next.querySelector("summary").textContent = "Tahun " + count + " · " + yearLabel(index);
    const sourceFields = previous.querySelectorAll("input");
    next.querySelectorAll("input").forEach((field, position) => {
      field.id = field.id.replace(/\d+$/, String(index));
      field.value = sourceFields[position].value;
    });
    yearForms.append(next);
  }
  yearCount = count;
  Array.from(yearForms.children).forEach((form, year) => {
    form.hidden = year >= yearCount;
  });
  document.getElementById("year-count").textContent = yearCount;
  document.getElementById("remove-year").disabled = yearCount === 1;

  const selected = Math.min(Number(resultYear.value) || 1, yearCount);
  resultYear.replaceChildren(...Array.from({length: yearCount}, (_, year) =>
    new Option("Tahun " + (year + 1) + " · " + yearLabel(year), String(year + 1))
  ));
  resultYear.value = String(selected);
  render();
}

function render() {
  const area = read("luas",true);
  const annualRent = read("rent0");
  const rentText = document.getElementById("rent0").value;
  for (let index = 1; index < yearCount; index++) {
    document.getElementById("rent" + index).value = rentText;
  }
  const plantingRate = read("grow0");
  const ratoonRate = yearCount > 1 ? read("grow1") : 0;
  const ratoonText = document.getElementById("grow1").value;
  for (let index = 2; index < yearCount; index++) {
    document.getElementById("grow" + index).value = ratoonText;
  }
  let cumulative = 0;
  const years = Array.from({length:yearCount},(_,i)=>{
    const input = {rent: annualRent, grow: i === 0 ? plantingRate : ratoonRate};
    for (const key of annualFields) {
      input[key] = read(key + i, key === "yield");
    }
    const year = project(area,input);
    cumulative += year.profit;
    return {...year,cumulative};
  });
  const totals = {};
  for (const key of ["profit","revenue","cost"]) totals[key] = years.reduce((sum,year)=>sum+year[key],0);
  const bounded = value => value === null || Number.isSafeInteger(Math.round(value));
  const valid = years.every(year=>Object.values(year).every(bounded)) && Object.values(totals).every(bounded);
  const bad = document.querySelector('input[aria-invalid="true"]:not([hidden] *)');
  document.getElementById("notice").textContent = bad ? "Periksa " + bad.labels[0].textContent.trim() + (bad.closest("details") ? " pada " + bad.closest("details").querySelector("summary").textContent : "") + ". Gunakan angka positif atau nol dan rupiah penuh." : valid ? "" : "Nilai perhitungan terlalu besar.";
  for (const [key,value] of Object.entries(totals)) document.getElementById(key).textContent = valid ? uang.format(value) : "—";
  document.getElementById("year-head").innerHTML = '<th scope="col">Komponen</th>' +
    years.map((_, index) => '<th class="year-column" scope="col">Tahun ' + (index + 1) + '</th>').join("");
  document.getElementById("rows").innerHTML = rows.map(([label,key])=>{
    const cells = years.map(year=>{
      const v = year[key];
      const display = !valid || v === null ? "—" : (key === "tons" ? angka : uang).format(v);
      return '<td class="year-column '+(valid && v<0 ? "negative" : "")+'">'+display+'</td>';
    }).join("");
    return '<tr class="'+(["profit","cumulative"].includes(key) ? "strong" : "")+'"><th scope="row">'+label+'</th>'+cells+'</tr>';
  }).join("");
  showResultYear();
}

function showResultYear() {
  const selected = Number(resultYear.value) - 1;
  document.querySelectorAll("#projection-table tr").forEach(row => {
    Array.from(row.querySelectorAll(".year-column")).forEach((cell, index) => {
      cell.classList.toggle("selected-year", index === selected);
    });
  });
}

resultYear.addEventListener("change", showResultYear);
document.addEventListener("input",render);
document.getElementById("add-year").addEventListener("click", () => resizeProjection(yearCount + 1));
document.getElementById("remove-year").addEventListener("click", () => resizeProjection(yearCount - 1));
resizeProjection(yearCount);