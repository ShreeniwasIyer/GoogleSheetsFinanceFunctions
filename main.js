
/* Key for this would be google api code, and the value would be a map of human readable dates strings to machine readable dates.

{
  'NYSE:T' : {
    '2018-11-29' : '151515151',
  }
}
*/
options_data_expiries = {};

/*
Key for this would be google API code and the value would be map of meta data
{
  'NYSE:T' : {
    stock_quote : stock_quote,
    high52 : high52,
    low52 : low52,
    cmp : cmp,
    target_put_strike_price : target_put_strike_price,
    put_strike_price : put_strike_price,
    found_good_strike : found_good_strike
  }
}
*/
options_meta_data = {};

/*
Key for this would be google_api_code + "_" + expiry_date and value would be an array of put pricing:

{
  'NYSE:T' : [{
    strike : stock_quote,
    openInterest : high52,
    bid : low52,
    ask : cmp
  },
  {
    ...
  }
  ]
}
*/
options_data_prices_puts = {};

options_data_prices_calls = {};

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

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

function getElementById(element, idToFind) {
  var descendants = element.getDescendants();
  for(i in descendants) {
    var elt = descendants[i].asElement();
    if( elt !=null) {
      var id = elt.getAttribute('id');
      if( id !=null && id.getValue()== idToFind) return elt;
    }
  }
}

function getElementsByTagName(element, tagName) {
  var data = [];
  var descendants = element.getDescendants();
  for(i in descendants) {
    var elt = descendants[i].asElement();
    if( elt !=null && elt.getName()== tagName) data.push(elt);
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

function get_US_option_expiry_dates(code, google_api_code, exchange, deductible) {
  var http_get_options = {
   'method' : 'get',
   'contentType': 'application/json'
  };
  var url_options = 'https://query2.finance.yahoo.com/v7/finance/options/' + code;
  var json_options = get_url_contents(url_options, http_get_options);
  console.log(json_options);
  var data_options = JSON.parse(json_options);

  /* Get basic meta data */
  var stock_quote = data_options.optionChain.result[0].quote;
  var high52 = stock_quote.fiftyTwoWeekHigh;
  var low52 = stock_quote.fiftyTwoWeekLow;
  var cmp = stock_quote.regularMarketPrice;

  var target_put_strike_price = cmp*(1-deductible);

  console.log(data_options);
  var all_strikes = data_options.optionChain.result[0].strikes;
  var put_strike_price = cmp;
  var found_good_strike = false;
  for(var i = 0; i < all_strikes.length; i++) {
    if(all_strikes[i] <= target_put_strike_price) {
      put_strike_price = all_strikes[i];
      found_good_strike = true;
    }
  }
  if(!found_good_strike) {
    // We didn't find a single strike price below the target
    return 0;
  }

  var stock_meta_data = {
    stock_quote : stock_quote,
    high52 : high52,
    low52 : low52,
    cmp : cmp,
    target_put_strike_price : target_put_strike_price,
    put_strike_price : put_strike_price,
    found_good_strike : found_good_strike
  }
  options_meta_data[google_api_code] = stock_meta_data;

  /* Get Expiry Dates and fill that in */
  var all_expiration_dates_numbers = data_options.optionChain.result[0].expirationDates;
  var all_expiration_dates = {};
  var base_date = new Date("1970-01-01");
  for(var i = 0; i < all_expiration_dates_numbers.length; i++) {
    var date_in_string_form = Utilities.formatDate(new Date(base_date.getTime()+(all_expiration_dates_numbers[i]*1000)), "GMT", "yyyy-MM-dd");
    //var date_in_string_form = (all_expiration_dates_numbers[i]*1000) + new Date("1970-01-01");
    all_expiration_dates[date_in_string_form] = all_expiration_dates_numbers[i];
  }
  options_data_expiries[google_api_code] = all_expiration_dates;
  return all_expiration_dates;
}

function get_AU_option_expiry_dates(code, google_api_code, exchange, deductible) {
  /* Key for this would be google api code, and the value would be a map of human readable dates strings to machine readable dates.

{
  'NYSE:T' : {
    '2018-11-29' : '151515151',
  }
}
*/
  var http_get_options = {
   'method' : 'get',
   'contentType': 'application/html'
  };
  var url_options = 'https://www.asx.com.au/asx/markets/optionPrices.do?by=underlyingCode&underlyingCode=' + code + '&expiryDate=&optionType=B';
  var content = get_url_contents(url_options, http_get_options);

  var table = Parser
                    .data(content)
                    .from('<table cellspacing="0" class="datatable options" id="optionstable">')
                    .to('</table>')
                    .build();
  table = table.replaceAll('<br>', '<br/>').replaceAll('&nbsp;','');

  var doc   = XmlService.parse(table), xml   = doc.getRootElement();
  var rows = getElementsByTagName(xml, 'tr');
  // Start from 1 to skip the header
  for (i = 1; i< rows.length; i++) {
    var cols = getElementsByTagName(rows[i], 'td');
    var date_raw = XmlService.getRawFormat().format(cols[0]);
    var date_raw_text = Parser.data(date_raw)
                    .from('<td>')
                    .to('</td>')
                    .build();
    var date_moment = Moment.moment(date_raw_text, 'D/MM/YYYY');
    var converted_date = date_moment.format("YYYY-MM-DD");
    Logger.log(converted_date);
  }
  return false;
}

function get_US_options_pricing(code, google_api_code, exchange, expiry_date_str, expiry_number) {
  var specific_expiry_url = 'https://query2.finance.yahoo.com/v7/finance/options/' + code + '?date=' + expiry_number;

  var http_get_options = {
   'method' : 'get',
   'contentType': 'application/json'
  };

  var json = get_url_contents(specific_expiry_url, http_get_options);
  var data = JSON.parse(json);

  var key = google_api_code + "_" + expiry_date_str;
  options_data_prices_puts[key] = data.optionChain.result[0].options[0].puts;
  options_data_prices_calls[key] = data.optionChain.result[0].options[0].calls;
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


  var DEDUCTIBLE = 0.01 * 5;
  var IDEAL_PREMIUM = 200.0;
  var NORMAL_LOT_SIZE = 100.0;
  var MIN_ARROC = 5;
  var DESIRED_OPEN_INTEREST = 0;
  var run_date = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd");

  all_expiration_dates = null;
  stock_meta_data = null;
  var currency = null;
  if(exchange === 'NASDAQ' || exchange === 'NYSE') {
    get_US_option_expiry_dates(code, google_api_code, exchange, DEDUCTIBLE);
    all_expiration_dates = options_data_expiries[google_api_code];
    stock_meta_data = options_meta_data[google_api_code];
    currency = 'USD';
  } else{
    currency = 'AUD';
    get_AU_option_expiry_dates(code, google_api_code, exchange, DEDUCTIBLE);
    return 0;
  }

  if(!stock_meta_data.found_good_strike) {
    // We didn't find a single strike price below the target
    return 0;
  }

  console.log("Established Strike Price is " + stock_meta_data.put_strike_price);

  var possible_options = [];
  for(var expiry in all_expiration_dates) {
    var key = google_api_code + "_" + expiry;

    if(exchange === 'NASDAQ' || exchange === 'NYSE') {
      get_US_options_pricing(code, google_api_code, exchange, expiry, all_expiration_dates[expiry]);
    } else{
      return 0;
    }

    var puts_data = options_data_prices_puts[key];
    var premium = 0;
    var days_to_expiry = Math.ceil(((new Date(expiry)).getTime() - (new Date()).getTime())/(24*3600*1000));;
    var annualized_premium = 0;
    var arroc = 0;
    var contracts = 0;
    for (var j = 0; j < puts_data.length; j++) {
      // All strikes below the strike price should be fine
      if(puts_data[j].strike <= stock_meta_data.put_strike_price &&
        puts_data[j].openInterest >= DESIRED_OPEN_INTEREST) {

        premium = puts_data[j].bid;
        strike = puts_data[j].strike;

        annualized_premium = premium * 365.0 / days_to_expiry;
        arroc = 100.0 * annualized_premium / strike;
        contracts = -1 * Math.ceil(IDEAL_PREMIUM/(premium*NORMAL_LOT_SIZE));
        if(arroc >= MIN_ARROC) {
          console.log("To be listed");
    //      Price of Underlying Security	Expiry	Status	Strike Price	Type	Premium	Contracts
          possible_options.push([run_date, google_api_code, currency, stock_meta_data.cmp, expiry, '', strike, 'PUT', premium, contracts]);
            /*{
              arroc : arroc,
              strike_price : strike_price,
              premium : premium,
              expiry : expiry,
              days_to_expiry : days_to_expiry
            }*/
        }
      }
    }
      /*
      // CALL OPTIONS GENERATOR
      var breakeven = cmp*(1 + DEDUCTIBLE);
      var stock_upside = 0;
      var IDEAL_CALL_PREMIUM = 100.0;
      var CHEAP_OPTION_THRESHOLD = 0.05;

      if(days_to_expiry <= 180) {
        // No need to do call calculations if the expiry is less than 6 month away
        continue;
      }

      var found_call = false;

      for (var j = 0; j < data.optionChain.result[0].options[0].calls.length && !found_call; j++) {
        // Check arroc since the length of the option could be more than a year away
        days_to_expiry = Math.ceil(((new Date(expiry)).getTime() - (new Date()).getTime())/(24*3600*1000));
        var actual_breakeven = breakeven;
        if(days_to_expiry >= 365) {
          actual_breakeven = breakeven * Math.pow((1 + DEDUCTIBLE), days_to_expiry/365);
        }
        premium = data.optionChain.result[0].options[0].calls[j].ask;
        strike = data.optionChain.result[0].options[0].calls[j].strike;
        stock_upside_at_breakeven = (actual_breakeven - strike - premium);
        contracts = Math.ceil(IDEAL_CALL_PREMIUM/(premium*NORMAL_LOT_SIZE));

        var premium_percentage = (1.0*premium)/strike;

        if(stock_upside_at_breakeven >= 0 || premium_percentage <= CHEAP_OPTION_THRESHOLD) {

          //      Price of Underlying Security	Expiry	Status	Strike Price	Type	Premium	Contracts
          possible_options.push([run_date, google_api_code, 'USD', cmp, expiry, '', strike, 'CALL', premium, contracts]);
            /*{
              arroc : arroc,
              strike_price : strike_price,
              premium : premium,
              expiry : expiry,
              days_to_expiry : days_to_expiry
            } /// SHOULD END HERE


          //if we have found one strike, it is good enough
          found_call = true;
        }
      }
      */

  }
  if(possible_options.length > 0) {
    var start_row = getFirstEmptyRow('Options Scratch Pad');
    var end_row = start_row + (possible_options.length - 1);
    var range = "A" + start_row + ":" + "J" + end_row;
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Options Scratch Pad').getRange(range).setValues(possible_options);
  }
  return possible_options.length;
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

function getFirstEmptyRowFromSheet(sheet) {
  var column = sheet.getRange('A:A');
  var values = column.getValues(); // get all data in one call
  var ct = 3;
  // Why start at 3 and not 0? Because there are a few tabs
  // where we fill them up with a space
  // We could devise a better algorithm, but not worth my time at the moment.
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

function update_weekly_numbers() {
  // Historical
  copy_values_and_formulas(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config'),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Historical'),
    "A",
    "U",
    13);
  // Historical - V2
  copy_values_and_formulas(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config'),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HistoricalV2'),
    "A",
    "Y",
    21);
  // Historical - V3
  copy_values_and_formulas(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config'),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HistoricalV3'),
    "A",
    "AA",
    16);
  // XIRR
  copy_values_and_formulas(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config'),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('XIRR'),
    "A",
    "O",
    36);

  // XIRR
  copy_values_and_formulas(
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config'),
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Historical Options'),
    "A",
    "AT",
    40);
}

function copy_values_and_formulas(fromSheet, toSheet, start_column, end_column, row_number) {
  var from_range = start_column + row_number + ":" + end_column + row_number;
  var adjusted_from_column = String.fromCharCode(start_column.charCodeAt(0) + 1);

  // End Column could be 2 characters - this won't work for Z, AZ and BZ etc.
  // I think we can live with it for the time being,
  var adjusted_to_column = "";
  if(end_column.length == 1) {
    adjusted_to_column = String.fromCharCode(end_column.charCodeAt(0) + 1);
  } else {
    adjusted_to_column = end_column.charAt(0) + String.fromCharCode(end_column.charCodeAt(1) + 1);
  }

  var to_last_row = getFirstEmptyRowFromSheet(toSheet);
  var to_range = adjusted_from_column + to_last_row + ":" + adjusted_to_column + to_last_row;
  var date_range = "A" + to_last_row + ":" + "A" + to_last_row;
  var date_formula_range = "A" + (to_last_row - 1) + ":" + "A" + (to_last_row - 1);
  toSheet.getRange(date_range).setFormulasR1C1(toSheet.getRange(date_formula_range).getFormulasR1C1());
  toSheet.getRange(to_range).setValues(fromSheet.getRange(from_range).getValues());

}
