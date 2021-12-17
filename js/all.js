// 使用 navigator.geolocation 抓出目前位置，放進 Mapbox 裡頭
let mymap = null;
// 使用 navigator web api 獲取當下位置（經緯度）
if(navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    // 如果成抓到位置的話，執行此函式
    function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      // console.log('目前位置', latitude, longitude);

      //Mapbox
      mymap = L.map('mapid').setView([latitude, longitude], 15);
      L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoicnlhbjExMDJzIiwiYSI6ImNreDV2ZmI0ODFjZXEydXBsNmpidW9iemQifQ.qohpVOsmatxeqDfTehKU1g'
      }).addTo(mymap);


      // 如果一開始沒有定位，後面就要重新設定 view 的位置
      // mymap.setView([latitude, longitude], 13);

      // 將經緯度傳給 getData 執行
      getStationData(latitude, longitude);
    },
    function (error) {
      // console.log('erroe', error);
    }
  )
}

// 抓取附近的自行車站
let stationData = [];
function getStationData(latitude, longitude) {
  axios({
    method: 'get',
    url: `https://ptx.transportdata.tw/MOTC/v2/Bike/Station/NearBy?%24top=30&%24spatialFilter=nearby(${latitude}, ${longitude},500)&%24format=JSON`,
    headers: getAuthorizationHeader()
  })
  .then(response => {
    stationData = response.data;
    // console.log('取得附近自行車站資料', stationData);
    getAvailableData(latitude, longitude)
  })
  .catch(error => {
    // console.log('error', error);
  })
}

// 抓取附近自行車站資訊
let filterData = [];
function getAvailableData(latitude, longitude) {
  axios({
    method: 'get',
    url: `https://ptx.transportdata.tw/MOTC/v2/Bike/Availability/NearBy?%24top=30&%24spatialFilter=nearby(${latitude}, ${longitude},500)&%24format=JSON`,
    headers: getAuthorizationHeader()
  })
  .then(response => {
    let amountData = response.data;
    // console.log('取得附近自行車站數量資訊', amountData);

    // 雙迴圈迭代，將上一個 api 資料放入這一個，再將其放入一新的陣列
    amountData.forEach(amountDataItem => {
      stationData.forEach(stationDataItem => {
        if(amountDataItem.StationUID === stationDataItem.StationUID) {
          amountDataItem.StationName = stationDataItem.StationName;
          amountDataItem.StationAddress = stationDataItem.StationAddress;
          amountDataItem.StationPosition = stationDataItem.StationPosition;
          filterData.push(amountDataItem);
        }
      })
    })
    // console.log('篩選過的資料',filterData);
    setMarker();
    getRoutesData();
  })
  .catch(error => {
    // console.log('error', error);
  })
}

// icon 標記
function setMarker() {
  // 將篩選的位置迭代放入地圖
  filterData.forEach(markPositionItem => {
    let marker = L.marker([markPositionItem.StationPosition.PositionLat, markPositionItem.StationPosition.PositionLon]).addTo(mymap)
    // 在標誌上放上文字顯示
    marker.bindPopup(`<div class="card">
                        <div class="card-body">
                          <h2 class="card-title">${markPositionItem.StationName.Zh_tw}</h2>
                          <h3 class="card-subtitle mb-2 text-muted">${markPositionItem.StationAddress.Zh_tw}</h3>
                          <p class="card-text mb-0 fs-4">可租借數量：${markPositionItem.AvailableRentBikes}</p>
                          <p class="card-text mb-0 fs-4">可歸還數量：${markPositionItem.AvailableReturnBikes}</p>
                        </div>
                      </div>`).openPopup(); // 若不一開始顯示則移除 openPopup
  })
}

// 選取自行車的路線
const bikeRoute = document.querySelector('#bikeRoute');
let routeGeometry = '';
function getRoutesData() {
  axios({
    method: 'get',
    url: `https://ptx.transportdata.tw/MOTC/v2/Cycling/Shape/Taichung?%24top=30&%24format=JSON`,
    headers: getAuthorizationHeader()
  })
  .then(response => {
    const routesData = response.data;
    // console.log('自行車路線', routesData);

    // 將路線名稱迭代放入選單
    let str = '';
    routesData.forEach(item => {
      str += `<option value="${item.RouteName}">${item.RouteName}</option>`
    })
    bikeRoute.innerHTML = str;

    // 選擇選單，將路線的位置抓出來
    bikeRoute.addEventListener('change', function(e) {
      let value = e.target.value;
      // console.log(value);

      // 若有畫線，先移除
      if(myLayer) {
        mymap.removeLayer(myLayer);
      }

      routesData.forEach(item => {
        if(item.RouteName === value) {
          routeGeometry = item.Geometry;
          // console.log(routeGeometry);
          polyLine(routeGeometry)
        }
      })
    })
  })
  .catch(error => {
    // console.log('error', error);
  })
}

// 位置轉換格式，畫出自行車的路線
let myLayer = null; // 建立一個路線圖層
function polyLine(routeGeometry) {
  // 建立一個 wkt 的實體
  const wkt = new Wkt.Wkt();
  // 讀取放入的參數，並轉成json格式
  const myLines = [{
    'type': 'LineString',
    'coordinates': wkt.read(routeGeometry).toJson().coordinates[0]
  }];
  // 預設樣式：將位置放入畫出，再放在地圖上
  // myLayer = L.geoJSON(geojsonFeature).addTo(mymap);

  const myStyle = {
    "color": "#d63384",
    "weight": 5,
    "opacity": 0.8
  };
  // console.log(myLines);
  // 將畫的線、樣式的圖層放在地圖上
  myLayer = L.geoJSON(myLines, {
    style: myStyle
  }).addTo(mymap);

  // 將畫面移到所畫的路線位置
  mymap.fitBounds(myLayer.getBounds());
}

// api 驗證函式
function getAuthorizationHeader() {
  //  填入自己 ID、KEY 開始
  let AppID = "652be68f06e647b3be2720359fe7803e";
  let AppKey = "TGATWwQUyq6jgNfnHRPKL25RmkI";
  //  填入自己 ID、KEY 結束
  let GMTString = new Date().toGMTString();
  let ShaObj = new jsSHA("SHA-1", "TEXT");
  ShaObj.setHMACKey(AppKey, "TEXT");
  ShaObj.update("x-date: " + GMTString);
  let HMAC = ShaObj.getHMAC("B64");
  let Authorization =
    'hmac username="' +
    AppID +
    '", algorithm="hmac-sha1", headers="x-date", signature="' +
    HMAC +
    '"';
  return { Authorization: Authorization, "X-Date": GMTString };
}
