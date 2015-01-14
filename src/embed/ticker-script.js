var TickerWidget = function (options) {
   var self = this;

  self.el         = d3.select("#prices").attr("class", "prices");
  self.apiHandler = new ApiHandler(options.url);
  self.options    = options;

  loader = d3.select("#tickerWrapper").append("img")
    .attr("class", "loader")
    .attr("src", "assets/images/rippleThrobber.png")

  //Not from QS
  if (!options.markets) options.markets = default_markets;
  self.markets = options.markets;
  addMarkets(self.markets);
  //--

  this.load = function(params){
    if (!params) params = {};
    if (!params.markets) params.markets = default_markets;
    self.markets = params.markets;
    addMarkets(self.markets);
  }

  this.loadFromQS = function(){
    var params = getParams();

    if (!params.markets) params.markets = default_markets;
    self.markets = params.markets;
    addMarkets(self.markets);
  }

  return this;
}

var Ticker = function(base, counter, markets, callback){
  var self = this;

  self.div        = markets.el.insert("div").attr("class","ticker");
  self.markets    = markets;
  self.price      = 0.0;
  self.startTime  = moment.utc().startOf("day");

  var gateways = ripple.currencyDropdown();
  base.name = gateways.getName(base.issuer);
  counter.name = gateways.getName(counter.issuer);

  var endTime = moment.utc().add(1,"d").startOf("day");
  var remainder = endTime.diff(moment.utc());

  if (remainder > 0){
    self.timeout = setTimeout(function(){
      console.log("FIRE!!");
      setNext();
      refreshTicker();
    }, remainder);
  } else {
    setNext();
  }

  self.reqUtcPrice = self.markets.apiHandler.offersExercised({    
    base : base,
    counter : counter,
    startTime : "2013-1-1",
    endTime : self.startTime,
    reduce: false,
    limit: 1,
    descending : true,
  }, function(oldPrice){

    self.oldPrice = oldPrice[0].price;

    self.reqCurrentPrice = self.markets.apiHandler.offersExercised({    
      base : base,
      counter : counter,
      startTime : moment.utc().subtract(1,"d"),
      endTime : moment.utc(),
      reduce: false,
      limit: 1,
      descending : true,
    }, function(lastPrice){

      self.price = lastPrice[0].price;
      self.difference = (((self.price-self.oldPrice)/self.oldPrice)*100).toFixed(2);

      console.log("%", self.price, self.oldPrice, self.difference);

      self.div.on("click", function(d){
        var path = "markets/"+base.currency+
          (base.issuer ? ":"+base.issuer : "")+
          "/"+counter.currency+
          (counter.issuer ? ":"+counter.issuer : "");
        window.location.href = "http://www.ripplecharts.com/#/" + path;
      });

      if (base.name !== "")
        self.div.append("div")
          .attr("class", "baseGateway")
          .text(base.name+"/");

      if (counter.name !== "")
        self.div.append("div")
          .attr("class", "counterGateway")
          .text(counter.name);

      self.divPrice = self.div.append("div")
        .attr("class", "price priceWrapper")
        .text(parseFloat(self.price).toFixed(6));

      if (base.currency !== "XRP")
        self.div.append("div")
          .attr("class", "baseCurrency")
          .text(base.currency+"/");

      self.div.append("div")
        .attr("class", "counterCurrency")
        .text(counter.currency);

      self.divPct = self.div.append("div")
        .attr("class", "pct")
        .text(self.difference+"%");

      self.divPriceStatus = self.div.append("div")
        .attr("class", "priceStatus priceunch");

      updatePct();

      callback();
      setLiveFeed(base, counter);
    });
  });
  
  function updatePct(){
    if (self.difference > 0){
        self.direction = "up"; 
        self.divPriceStatus.attr("class", "priceStatus priceup");
        self.divPct.attr("class", "pct pctUp");
      }
    else if (self.difference < 0){ 
        self.direction = "down";
        self.divPriceStatus.attr("class", "priceStatus pricedown");
        self.divPct.attr("class", "pct pctDown");
      }
    else self.direction = "unch";
  }

  function refreshTicker(){
    self.newUtcPrice = self.markets.apiHandler.offersExercised({    
      base : base,
      counter : counter,
      startTime : "2013-1-1",
      endTime : self.startTime,
      reduce: false,
      limit: 1,
      descending : true,
    }, function(oldPrice){
      self.oldPrice = oldPrice[0].price;
      self.difference = (((self.price-self.oldPrice)/self.oldPrice)*100).toFixed(2);
      console.log("Refresh");
      self.divPct.text(self.difference+"%");
      updatePct();
    });
  }

  function setNext(){
    self.timeout = setInterval(function(){
      refreshTicker();
    },86400000);
  }

  //enable the live feed via ripple-lib
  function setLiveFeed (base, counter) {
    var point = {
        startTime     : moment.utc(),
        baseVolume    : 0.0,
        counterVolume : 0.0, 
        count         : 0,
        open          : 0.0,
        high          : 0.0,
        low           : 0.0,
        close         : 0.0,
        vwap          : 0.0,
        openTime      : null,
        closeTime     : null
      };
    
    var viewOptions = {
      base    : base,
      counter : counter,
      timeIncrement    : "minute",
      timeMultiple     : 15,
      incompleteApiRow : point
    }
    
    liveFeed = new OffersExercisedListener (viewOptions, liveUpdate);
  }

  //add new data from the live feed to the chart  
  function liveUpdate (data) {
    var direction;
    var prev = self.price;

    if (data.close !== 0) self.price = data.close;
    
    //price lower, flash red
    if (prev > self.price){
      self.div.select(".price")
        .style("color", "#a22");
      self.div.select(".price")
        .transition().delay(500)
        .text(parseFloat(self.price).toFixed(6));
      self.div.select(".price")
        .transition().delay(1500).duration(500)
        .style("color", "#3C3C3C:")
    }
    //price higher, flash green
    else if (prev < self.price){
      self.div.select(".price")
        .style("color", "#483");
      self.div.select(".price")
        .transition().delay(500)
        .text(parseFloat(self.price).toFixed(6));
      self.div.select(".price")
        .transition().delay(1500).duration(500)
        .style("color", "#3C3C3C:")
    }

    self.difference = (((self.price-self.oldPrice)/self.oldPrice)*100).toFixed(2);
    updatePct();

  }
}

function addTicker(base, counter, callback){
  new Ticker(base, counter, self, callback);
};

function getParams () {
  var params = {};
  var query  = window.location.search.substring(1);
  var vars   = query ? query.split("&") : [];
  
  for (var i = 0; i < vars.length; i++) {
    var pair  = vars[i].split('=');
    var key   = decodeURIComponent(pair[0]);
    var value = decodeURIComponent(pair[1]);
    
    try {
      params[key] = JSON.parse(value);
    } catch (e) { //invalid json
      params[key] = value;
    } 
  } 
  return params;   
}

function addMarkets(markets){
  //add markets async and once done, remove loader
  var count = 0;
  for (var i=0; i<markets.length; i++){
    var market = markets[i];
    addTicker(market.base, market.counter, function(){
      count += 1;
      if (count === markets.length) {
        d3.selectAll(".loader").remove();
        d3.selectAll(".ticker").style("opacity", 1);
        
        $("#prices").smoothDivScroll({
            autoScrollingDirection: "endlessLoopRight",
            autoScrollingStep: 1,
            autoScrollingInterval: 15,
            hotSpotScrolling: false 
          });

        $("#prices").smoothDivScroll("startAutoScrolling");

        $("#prices").bind("mouseover", function(){
          $("#prices").smoothDivScroll("stopAutoScrolling");
        });
        
        // Mouse out
        $("#prices").bind("mouseout", function(){
          $("#prices").smoothDivScroll("startAutoScrolling");
        });


      }
    });
  }
}

var default_markets = [
  {
    base: {"currency":"XRP"},
    counter: {"currency":"USD","issuer":"rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q"}
  }
];

