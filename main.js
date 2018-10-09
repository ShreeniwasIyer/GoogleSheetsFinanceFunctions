function get_url_contents(url, options) {
  var cache_key = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url + options);
  var cache = CacheService.getScriptCache();
  var contents = cache.get(cache_key);
  if(contents == null) {
    var response =  UrlFetchApp.fetch(url, options);
    contents = response.getContentText();
    if(contents.length <= 100000) {
      var length = contents.length;
      cache.put(cache_key, contents, 60);
    }
  }
  return contents;
}

function getElementsByClassName(element, classToFind) {
  var data = [];
  var descendants = element.getDescendants();
  descendants.push(element);
  for(i in descendants) {
    var elt = descendants[i].asElement();
    if(elt != null) {
      var classes = elt.getAttribute('class');
      if(classes != null) {
        classes = classes.getValue();
        if(classes == classToFind) data.push(elt);
        else {
          classes = classes.split(' ');
          for(j in classes) {
            if(classes[j] == classToFind) {
              data.push(elt);
              break;
            }
          }
        }
      }
    }
  }
  return data;
}

function expected_value(structure, current_price, current_target, worst_case, best_case, dividend, option_cost, option_strike) {
  if(structure === undefined) {
    structure = "CALL";
  }
  if(current_price === undefined) {
    current_price = 32.65;
  }
  if(current_target === undefined) {
    current_target = 39.80;
  }
  if(worst_case === undefined) {
    worst_case = current_price*0.60;
  }
  if(best_case === undefined) {
    best_case = current_target*1.4;
  }
  if(dividend === undefined) {
    dividend = current_price*0.05;
  }
  if(option_cost === undefined) {
    option_cost = 2.49;
  }

  if(option_strike === undefined) {
    option_strike = current_price;
  }

  var worse_case_splits = (current_price - worst_case)/5;
  var average_case_splits = (current_target - current_price)/5;
  var better_case_splits = (best_case - current_target)/5;
  var price_points = [
    worst_case,
    worst_case + worse_case_splits,
    worst_case + 2*worse_case_splits,
    worst_case + 3*worse_case_splits,
    worst_case + 4*worse_case_splits,
    current_price,
    current_price + average_case_splits,
    current_price + 2*average_case_splits,
    current_price + 3*average_case_splits,
    current_price + 4*average_case_splits,
    current_target,
    current_target + better_case_splits,
    current_target + 2*better_case_splits,
    current_target + 3*better_case_splits,
    current_target + 4*better_case_splits,
    best_case
  ];
  var distribution = [
    0.02,
    0.02,
    0.02,
    0.02,
    0.02,
    0.8/6,
    0.8/6,
    0.8/6,
    0.8/6,
    0.8/6,
    0.8/6,
    0.02,
    0.02,
    0.02,
    0.02,
    0.02
  ];
  var ev = 0;
  if(structure == "CASH") {
    for(i = 0; i< distribution.length; i++) {
      var case_ev = price_points[i] - current_price + dividend;
      var weighted_case_ev = case_ev * distribution[i];
      ev += weighted_case_ev
    }
  } else if (structure = "CALL") {
    for(i = 0; i< distribution.length; i++) {
      var case_ev = (price_points[i] > (option_strike + option_cost))
                    ? price_points[i] - option_strike - option_cost
                    : 0;
      var weighted_case_ev = case_ev * distribution[i];
      ev += weighted_case_ev
    }
  } else if (structure == "PUT") {
    for(i = 0; i< distribution.length; i++) {
      var case_ev = (price_points[i] > (option_strike + option_cost))
                    ? option_cost
                    : -1*(price_points[i] - option_strike - option_cost);
      var weighted_case_ev = case_ev * distribution[i];
      ev += weighted_case_ev
    }
  }
  return ev;

}
function get_call_options_pricing(ticker, date_of_expiry, strike_price, type) {
  if(ticker === undefined) {
    ticker = 't';
  }
  if(date_of_expiry === undefined) {
    date_of_expiry = '2020-01-17';
  }
  if(strike_price === undefined) {
    strike_price = 32.65;
  }
  if(type === undefined) {
    type = "CALL";
  }
  var formatted_date_of_expiry = "" + ((new Date(date_of_expiry) - new Date("1970-01-01"))/1000);


  var url = 'https://query2.finance.yahoo.com/v7/finance/options/' + ticker + '?date=' + formatted_date_of_expiry;
  var options = {
   'method' : 'get',
   'contentType': 'application/json'
  };
  var json = get_url_contents(url, options);
  console.log(json);
  var data = JSON.parse(json);
  console.log(data);
  var strikes = data.optionChain.result[0].strikes;
  var min_difference_from_strike = 10000000000;
  var closest_strike = strike_price;
  var closest_strike_index = 0;
  for(i = 0; i < strikes.length; i++) {
    if(Math.abs(strikes[i] - strike_price) < min_difference_from_strike) {
      min_difference_from_strike = Math.abs(strikes[i] - strike_price);
      closest_strike = strikes[i];
      closest_strike_index = i;
    }
  }
  var allData = {
    "CALL" : data.optionChain.result[0].options[0].calls[closest_strike_index].lastPrice,
    "PUT"  : data.optionChain.result[0].options[0].puts[closest_strike_index].lastPrice
  }
  return allData[type];
}

function sgx_quote(code, type) {
  if(code === undefined) {
    code = 'Z74'; // Singtel code
  }
  if(type === undefined) {
   type = 'price';
  }
  var url = 'https://query2.finance.yahoo.com/v7/finance/quote?formatted=true&lang=en-US&region=US&symbols=' + code + '.SI&fields=messageBoardId%2ClongName%2CshortName%2CmarketCap%2CunderlyingSymbol%2CunderlyingExchangeSymbol%2CheadSymbolAsString%2CregularMarketPrice%2CregularMarketChange%2CregularMarketChangePercent%2CregularMarketVolume%2Cuuid%2CregularMarketOpen%2CfiftyTwoWeekLow%2CfiftyTwoWeekHigh';
  var options = {
   'method' : 'get',
   'contentType': 'application/json'
  };
  var json = get_url_contents(url, options);
  console.log(json);
  var data = JSON.parse(json);
  var actualData = data.quoteResponse.result[0];
  var allData = {
    'name' : actualData.shortName,
    'pe'   : 'None',
    'eps'  : 'None',
    'marketCap': 'None',
    'high52' : actualData.fiftyTwoWeekHigh.raw,
    'low52' : actualData.fiftyTwoWeekLow.raw,
    'price' : actualData.regularMarketPrice.raw,
    'change'   : actualData.regularMarketChange.raw,
    'changepct'  : actualData.regularMarketChangePercent.raw
  };

  return allData[type];
}

/*
function sgx_quote(code, type) {
  if(code === undefined) {
    code = 'Z74'; // Singtel code
  }
  if(type === undefined) {
   type = 'price';
  }
  if(code === 'G3B') {
    return g3b_quote(type);
  }
  var url = 'https://sgx-premium.wealthmsi.com/sgx/price';
  var companyUrl = 'https://sgx-premium.wealthmsi.com/sgx/company';
  var data = {'id': code};
  var options = {
   'method' : 'post',
   'contentType': 'application/json',
   // Convert the JavaScript object to a JSON string.
   'payload' : JSON.stringify(data)
  };
  switch(type) {
    case 'price':
    case 'change':
    case 'changepct':
        var json = get_url_contents(url, options);
        console.log(json);
        var data = JSON.parse(json);
        var allData = {
          'price' : data.price.lastPrice,
          'change'   : data.price.change,
          'changepct'  : data.price.percentChange
        }
        return allData[type];
    case 'name':
    case 'pe':
    case 'eps':
    case 'marketcap':
    case 'high52':
    case 'low52':
        var json = get_url_contents(url, options);
        var data = JSON.parse(json);

        var allData = {
          'name' : data.company.companyInfo.companyName,
          'pe'   : data.company.companyInfo.peRatio,
          'eps'  : data.company.companyInfo.eps,
          'marketCap': data.company.companyInfo.marketCap,
          'high52' : data.company.companyInfo.yearHigh,
          'low52' : data.company.companyInfo.yearLow
        }
        return allData[type];
  }

}
*/

function get_target_string(cmp, target, current_overall_position, current_capital_gain_position) {
  if(target === undefined || target == '') {
   return "Target not known";
  }
  target = parseInt(target);

  if(cmp >= target) {
    if(current_capital_gain_position >= 0) {
      return "SELL";
    } else if (current_overall_position >= 0) {
      return "RETREAT";
    } else {
      return "SIUAW";
    }
  } else if(cmp < 0.85 * target) {
    return "BUY";
  } else {
    return "HOLD";
  }
  /*

  if(
    ISNUMBER(
        VLOOKUP(B17, Tickers!$D$1:$X$88, 19, false)
    ),
    if(
        M17 > VLOOKUP(B17, Tickers!$D$1:$X$88, 19, false),
        if(N17 > 0, "SELL", "RETREAT"),
        if(
            M17 < VLOOKUP(B17, Tickers!$D$1:$X$88, 19, false) * 0.9,
            "BUY",
            "HOLD"
        )
    ),
    "")
    */
}

function run_all_option_candidates() {
  var columns = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Options Candidates').getRange('B:C');
  var values = columns.getValues(); // get all data in one call
  var ct = 1;
  while ( values[ct][0] != "" && values[ct][1] != "") {
    if(values[ct][0] == 'NASDAQ' || values[ct][0] == 'NYSE') {
      get_good_options(values[ct][1], values[ct][0] + ":" + values[ct][1], values[ct][0]);
    }
    ct++;
  }
  return true;
}

function get_good_options(code, google_api_code, exchange) {
  if(exchange === undefined) {
    exchange = 'ASX';
  }
  if(code === undefined) {
    code = 'MTS'; // AT&T code
    google_api_code = 'ASX:MTS';
  }
  var code_calculated = code_exists_in_tab('Options Scratch Pad', 'B', google_api_code);
  if(code_calculated) {
    Logger.log("Skipped calculating options for " + google_api_code + ", since it pre-exists");
    return 0;
  }

  if(exchange === 'NASDAQ' || exchange === 'NYSE') {
    var http_get_options = {
     'method' : 'get',
     'contentType': 'application/json'
    };
    var DEDUCTIBLE = 0.01 * 10;
    var IDEAL_PREMIUM = 200.0;
    var NORMAL_LOT_SIZE = 100.0;
    var MIN_ARROC = 8;


    var url_options = 'https://query2.finance.yahoo.com/v7/finance/options/' + code;
    var json_options = get_url_contents(url_options, http_get_options);
    console.log(json_options);
    var data_options = JSON.parse(json_options);
    var stock_quote = data_options.optionChain.result[0].quote;
    var high52 = stock_quote.fiftyTwoWeekHigh;
    var low52 = stock_quote.fiftyTwoWeekLow;
    var cmp = stock_quote.regularMarketPrice;
    var target_strike_price = cmp*(1-DEDUCTIBLE);

    console.log(data_options);
    var all_strikes = data_options.optionChain.result[0].strikes;
    var strike_price = cmp;
    var found_good_strike = false;
    for(var i = 0; i < all_strikes.length; i++) {
      if(all_strikes[i] <= target_strike_price) {
        strike_price = all_strikes[i];
        found_good_strike = true;
      }
    }
    if(!found_good_strike) {
      // We didn't find a single strike price below the target
      return 0;
    }

    console.log("Established Strike Price is " + strike_price);
    //var formatted_date_of_expiry = "" + ((new Date(date_of_expiry) - new Date("1970-01-01"))/1000);
    var all_expiration_dates_numbers = data_options.optionChain.result[0].expirationDates;
    var all_expiration_dates = {};
    var base_date = new Date("1970-01-01");
    var run_date = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");
    for(var i = 0; i < all_expiration_dates_numbers.length; i++) {
      var date_in_string_form = Utilities.formatDate(new Date(base_date.getTime()+(all_expiration_dates_numbers[i]*1000)), "GMT", "yyyy-MM-dd");
      //var date_in_string_form = (all_expiration_dates_numbers[i]*1000) + new Date("1970-01-01");
      all_expiration_dates[date_in_string_form] = all_expiration_dates_numbers[i];
    }
    var possible_options = [];
    for(var expiry in all_expiration_dates) {
      var specific_expiry_url = 'https://query2.finance.yahoo.com/v7/finance/options/' + code + '?date=' + all_expiration_dates[expiry];
      var json = get_url_contents(specific_expiry_url, http_get_options);
      var data = JSON.parse(json);
      var premium = 0;
      for (var j = 0; j < data.optionChain.result[0].options[0].puts.length; j++) {
        if(data.optionChain.result[0].options[0].puts[j].strike == strike_price &&
          data.optionChain.result[0].options[0].puts[j].openInterest >= 100) {
          premium = data.optionChain.result[0].options[0].puts[j].lastPrice;
        }
      }
      var days_to_expiry = Math.ceil(((new Date(expiry)).getTime() - (new Date()).getTime())/(24*3600*1000));
      var annualized_premium = premium * 365.0 / days_to_expiry;
      var arroc = 100.0 * annualized_premium / strike_price;
      var contracts = Math.ceil(IDEAL_PREMIUM/(premium*NORMAL_LOT_SIZE));
      if(arroc > MIN_ARROC) {
        console.log("To be listed");
  //      Price of Underlying Security	Expiry	Status	Strike Price	Type	Premium	Contracts
        possible_options.push([run_date, google_api_code, 'USD', cmp, expiry, '', strike_price, 'PUT', premium, contracts]);
          /*{
            arroc : arroc,
            strike_price : strike_price,
            premium : premium,
            expiry : expiry,
            days_to_expiry : days_to_expiry
          }*/
      }
    }
    if(possible_options.length > 0) {
      var start_row = getFirstEmptyRow('Options Scratch Pad');
      var end_row = start_row + (possible_options.length - 1);
      var range = "A" + start_row + ":" + "J" + end_row;
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Options Scratch Pad').getRange(range).setValues(possible_options);
    }
    return possible_options.length;
  }
  return 0;

}

function getFirstEmptyRow(tab_name) {
  var column = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab_name).getRange('A:A');
  var values = column.getValues(); // get all data in one call
  var ct = 0;
  while ( values[ct][0] != "" ) {
    ct++;
  }
  return (ct + 1);
}

function code_exists_in_tab(tab_name, column_character, google_api_code) {
  var column = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab_name).getRange(column_character + ':' + column_character);
  var values = column.getValues(); // get all data in one call
  var ct = 0;
  while ( values[ct][0] != "") {
    if(values[ct][0] == google_api_code) {
      return true;
    }
    ct++;
  }
  return false;
}
