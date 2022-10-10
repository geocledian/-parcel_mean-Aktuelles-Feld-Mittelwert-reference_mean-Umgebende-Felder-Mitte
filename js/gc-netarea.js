/*
 Vue.js Geocledian netarea component
 created: 2022-10-01, jsommer
 last update: 2022-10-10, jsommer
 version: 0.1.0
*/
"use strict";

//language strings
const gcNetareaLocales = {
  "en": {
    "options": { "title": "Net area" },
    "description": { 
      "id": "ID",
      "parcel": "Parcel",
      "sdate": "Sensing date"
    },
    "date_format_hint": "YYYY-MM-DD",
    "legend" : { 
      "uncultivated_area" : "uncultivated area",
      "area_under_crops" : "area under crops",
      "fraction_under_crops" : "fraction under crops",
    }
  },
  "de": {
    "options": { "title": "Nettofläche" },
    "description": { 
      "id": "Nr",
      "parcel": "Feld",
      "sdate": "Aufnahmedatum"
    },
    "date_format_hint": "JJJJ-MM-TT",
    "legend" : { 
      "uncultivated_area" : "unbewirtschaftete Fläche",
      "area_under_crops" : "bewirtschaftete Fläche",
      "fraction_under_crops" : "Anteil bewirtschafteter Fläche",
    }
  },
}

Vue.component('gc-netarea', {
  props: {
    gcWidgetId: {
      type: String,
      default: 'netarea1',
      required: true
    },
    gcApikey: {
      type: String,
      default: '39553fb7-7f6f-4945-9b84-a4c8745bdbec'
    },
    gcHost: {
      type: String,
      default: 'geocledian.com'
    },
    gcProxy: {
      type: String,
      default: undefined
    },
    gcApiBaseUrl: {
      type: String,
      default: "/agknow/api/v4"
    },
    gcApiSecure: {
      type: Boolean,
      default: true
    }, 
    gcParcelId: {
      default: -1
    },
    gcSelectedDate: {
      type: String,
      default: "" // date for sending against the API
    },
    gcMode: {
      type: String,
      default: "gauge" // "pie" || "gauge" || "donut"
    },
    gcAvailableOptions: {
      type: String,
      default: "title,description,dateSelector,legend" // available options
    },
    gcWidgetCollapsed: {
      type: Boolean,
      default: true // or true
    },
    gcLanguage: {
      type: String,
      default: 'en' // 'en' | 'de'
    },
    gcLegendPosition: {
      type: String,
      default: 'inset' // 'bottom', 'right' or 'inset'
    },
    gcWhiteLabel: {
      type: Boolean,
      default: false // true or false
    }
  },
  template: `<div :id="gcWidgetId" class="gc-netarea" style="max-width: 18.0rem; min-width: 8rem;">       

              <p :class="['gc-options-title', 'is-size-6', gcWidgetCollapsed ? 'gc-is-primary' : 'gc-is-tertiary']" 
                style="cursor: pointer; margin-bottom: 1em;" 
                v-on:click="toggleNetarea"   
                v-show="this.availableOptions.includes('title')">
                {{ $t('options.title') }}
                <i :class="[gcWidgetCollapsed ? '': 'is-active', 'fas', 'fa-angle-down', 'fa-sm']"></i>
              </p>

              <!-- widget container -->
              <div :class="[gcWidgetCollapsed ? '': 'is-hidden']">
               <div class="is-flex">
                <div :id="'desc_' + gcWidgetId" class="gc-is-tertiary" v-show="this.availableOptions.includes('description')">
                  <span class="has-text-weight-bold is-size-7">{{ $t('description.parcel') }} {{ $t('description.id') }}: {{this.currentParcelID}}</span><br>
                  <span class="is-size-7" v-show="netarea.hasOwnProperty('net_area')">{{ $t('description.sdate') }}: {{this.netarea.sensing_date}}</span>
                </div>

                <div class="field-body is-horizontal" style="margin-left: 1em;"
                    v-show="this.availableOptions.includes('dateSelector')">
                  <div class="control" style="padding-bottom: 0px; max-width: 5.8rem;">
                    <input :id="'inpSdate_'+this.gcWidgetId" type="text" class="input is-small" :placeholder="$t('date_format_hint')" style="height: 2.1rem;"
                      v-model="selectedDate">
                  </div>
                </div>
                </div>

                <!-- watermark -->
                <div :class="[this.gcWhiteLabel ? 'is-hidden': 'is-inline-block', 'is-pulled-right']"
                  style="opacity: 0.65;">
                  <span style="vertical-align: top; font-size: 0.7rem;">powered by</span><br>
                  <img src="img/logo.png" alt="geo|cledian" style="width: 100px; margin: -10px 0;">
                </div>
               

                <!-- watermark message -->
                <div class="notification gc-api-message" style="position: relative; opacity: 1.0; margin-bottom: 0.5rem; z-index: 1001; font-size: 0.9rem;"
                  v-show="watermark_msg.length>0" v-html="$t(watermark_msg)  +  '<br>' + $t('api_err_msg.support')">
                </div>
      
                <!-- other api messages -->
                <div class="notification gc-api-message" v-show="api_err_msg.length > 0" v-html="$t(api_err_msg) +  '<br>' + $t('api_err_msg.support')"></div>

                
                <div class="chartSpinner spinner" v-show="isloading">
                  <div class="rect1"></div>
                  <div class="rect2"></div>
                  <div class="rect3"></div>
                  <div class="rect4"></div>
                  <div class="rect5"></div>
                </div>

                <!-- v-show directive does not play nice with billboard.js so put it one layer above! -->
                <div style="position: relative;" v-show="api_err_msg.length==0">
                  <div v-show="isloading == false">
                    <div :id="'chart_'+gcWidgetId" :class="['gc-netarea-chart-'+this.gcMode]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- chart -->`,
  data: function () {
    return {
      chart: undefined,
      parcels: [],
      offset: 0,
      pagingStep: 6000,
      total_parcel_count: 250,
      netarea : {},
      inpSdatePicker: undefined,
      internalSelectedDate: "", //for internal use only
      api_err_msg: "",
      watermark_msg: "",
      isloading: true
    }
  },
  computed: {
    apiKey: {
      get: function () {
          return this.gcApikey;
      }
    },
    apiHost: {
        get: function () {
            return this.gcHost;
        }
    },
    apiBaseUrl: {
        get: function () {
            return this.gcApiBaseUrl;
      }
    },
    apiSecure: {
      get: function () {
          return this.gcApiSecure;
      }
    },
    apiMajorVersion: {
      get () {
        if (this.apiBaseUrl === "/agknow/api/v3") {
          return 3
        }
        if (this.apiBaseUrl === "/agknow/api/v4") {
          return 4
        }
      }
    },
    currentParcelID:  {
      get: function() {
          return this.gcParcelId;
      },
    },
    // chartWidth: function() {
    //     console.debug("clientwidth "+document.getElementById(this.gcWidgetId).clientWidth);
    //     console.debug("offsetwidth "+document.getElementById(this.gcWidgetId).offsetWidth);
    //     return parseInt(document.getElementById(this.gcWidgetId).offsetWidth);
    // },
    // chartHeight: function() {
    //     console.debug("clientheight "+document.getElementById(this.gcWidgetId).clientHeight);
    //     console.debug("offsetheight "+document.getElementById(this.gcWidgetId).offsetHeight);
    //     //return parseInt(document.getElementById(this.gcWidgetId).offsetHeight);
    //     return parseInt(document.getElementById(this.gcWidgetId).style.height);
    // },
    selectedDate: {
      get: function() {
        // either outer selected date
        if (this.gcSelectedDate.length > 0) {
          if (this.isDateValid(this.gcSelectedDate))
            return this.gcSelectedDate;
        }// or internal selected date
        else {
          if (this.isDateValid(this.internalSelectedDate))
            return this.internalSelectedDate;
        }
      },
      set: function(value) {
        console.debug("selectedDate - setter: "+value);

        if (this.isDateValid(value)) {
          //should set gcSelectedDate from root to the new value
          this.$root.$emit("queryDateChange", value);
          this.internalSelectedDate = value;
        }
      }
    },
    availableOptions: {
      get: function() {
        return (this.gcAvailableOptions.split(","));
      }
    },
    currentLanguage: {
      get: function() {
        // will always reflect prop's value 
        return this.gcLanguage;
      },
    },
  },
  i18n: { 
    locale: this.currentLanguage,
    messages: gcNetareaLocales
  },
  created: function () {
    console.debug("netarea! - created()");
    this.changeLanguage();
  },
  /* when vue component is mounted (ready) on DOM node */
  mounted: function () {

    // listen on size change handler
    this.$root.$on("containerSizeChange", this.containerSizeChange);

    //initial loading data
    if (this.gcParcelId > 0) {
      this.currentParcelID = this.gcParcelId;
      this.handleCurrentParcelIDchange();
    }

    // init datepickers
    if (this.availableOptions.includes('dateSelector')) {
      this.initDatePickers();
    }
  },
  watch: {
    currentParcelID: function (newValue, oldValue) {

      console.debug("event - currentParcelIDChange");

      this.handleCurrentParcelIDchange(newValue, oldValue);
    },
    selectedDate: function (newValue, oldValue) {

      console.debug("event - sdateChange");

      if (this.isDateValid(this.selectedDate)) {
        this.getNetarea(this.getCurrentParcel().parcel_id, this.selectedDate);
      }
    },
    netarea: {
      handler: function (newValue, oldValue) {

        console.debug("event - netareaChange");

        // create chart from values, if they change
        this.createChartData();
      },
      deep: true
    },
    currentLanguage(newValue, oldValue) {
      this.changeLanguage();
      // rebuild chart if language changed, otherwise localization will not refresh
      this.createChartData();
      // reinit date pickers for different language
      this.initDatePickers();
    },
    gcMode(newValue, oldValue) {
      // gauge shall always have bottom position for legend
      if (newValue === "gauge") {
        this.gcLegendPosition = "bottom";
      }
      this.createChartData();
    },
    gcLegendPosition(newValue, oldValue) {
      // gauge shall always have bottom position for legend
      if (newValue === "inset" && this.gcMode === "gauge") {
        this.gcLegendPosition = "bottom";
      }
      this.createChartData();
    },
  },
  methods: {
    getApiUrl: function (endpoint) {
      /* handles requests directly against  geocledian endpoints with API keys
          or (if gcProxy is set)
        also requests against the URL of gcProxy prop without API-Key; then
        the proxy or that URL has to add the api key to the requests against geocledian endpoints
      */
      let protocol = 'http';

      if (this.apiSecure) {
        protocol += 's';
      }

      // if (this.apiEncodeParams) {
      //   endpoint = encodeURIComponent(endpoint);
      // }
      
      // with or without apikey depending on gcProxy property
      return (this.gcProxy ? 
                protocol + '://' + this.gcProxy + this.apiBaseUrl + endpoint  : 
                protocol + '://' + this.gcHost + this.apiBaseUrl + endpoint + "?key="+this.apiKey);
    },
    toggleNetarea: function () {
      this.gcWidgetCollapsed = !this.gcWidgetCollapsed;
    },
    containerSizeChange(size) {
      /* handles the resize of the chart if parent container size changes */
      if (this.chart) {
        setTimeout(function(){ 
          this.chart.resize();
        }.bind(this),
        200
        );
      }
    },
    handleCurrentParcelIDchange: function () {

      console.debug("methods - handleCurrentParcelIDchange");

      //only if valid parcel id
      if (this.currentParcelID > 0) {
      
        this.filterDetailData();

        this.getNetarea(this.getCurrentParcel().parcel_id, this.selectedDate);
      }
    },
    //returns detailed data from REST service by passing the selected parcel_id
    filterDetailData: function () {

      console.debug("methods - filterDetailData");
      
    },
    getCurrentParcel: function () {
      return {parcel_id: this.currentParcelID};
    },
    getNetarea: function(parcel_id, sdate) {

      this.api_err_msg = "";
      this.watermark_msg = "";
      this.isloading = true;

      const endpoint = "/parcels/"+parcel_id+"/netarea";
      let params = "&date="+ sdate;
    
      //Show requests on the DEBUG console for developers
      console.debug("getNetarea()");
      console.debug("GET " + this.getApiUrl(endpoint) + params);
  
      //clear chart
      if (this.chart) {
        this.chart.unload();
      }

      axios({
        method: 'GET',
        url: this.getApiUrl(endpoint) + params,
      }).then(function (response) {
        console.debug(response);
        if(response.status === 200){
          try {
            var result  = response.data;
            if (this.apiMajorVersion === 4) {
              this.netarea = result.content;
              this.isloading = false;
            }
          } catch (err) {
            console.error(err);
            this.api_err_msg = err;
            this.isloading = false;
          }
        } else {
          this.api_err_msg = response.data;
          this.isloading = false;
        }
      }.bind(this)).catch(err => {
        this.api_err_msg = err.response.data;
        this.isloading = false;
      })
    },
    createChartData: function() {

      console.debug("createChartData()");
  
      let columns = [];

      if (this.apiMajorVersion === 4) {
        if (this.netarea) {
          if (this.gcMode == "pie" || this.gcMode == "donut") {
            // format values to 2 decimals
            columns[0] = ["area under crops"].concat(this.formatDecimal(this.netarea.net_area, 2));
            // calculate relative uncultivated area from parcel's area and inverse fraction under crop
            
            // TODO uncultivated area only possible with parcel's area!
            // const uncultivated_area = this.netarea.summary.area * (1.0 - this.netarea.fraction);
            
            // workaround for net_area >= 0
            let uncultivated_area;

            if (this.netarea.fraction > 0)  {
              uncultivated_area = this.netarea.fraction * this.netarea.net_area;
            } else {
              uncultivated_area = undefined;
            }
            columns[1] = ["uncultivated area"].concat(this.formatDecimal(uncultivated_area, 2));
          }
          if (this.gcMode == "gauge")  {
            // format values to 2 decimals
            columns[0] = ["fraction under crops"].concat(this.formatDecimal(this.netarea.fraction *100, 2));
          }

          this.createChart(columns);
        }
      }

    },
    createChart: function(data) {

      console.debug("createChart()");
      console.debug(data);

      let color_options = {};

      if (this.gcMode == "gauge") {
        color_options = {
          // four color levels for the percentage values: red (0-24%), orange (25-49%), yellow (50-74%), green (> 75%)
          pattern: ['#FF0000', '#F97600', '#F6C600', '#60B044'], 
          threshold: {
              // unit: 'value', // percentage is default
              max: 100, // 100 is default
              values: [25, 50, 75, 100]
          }
        };
      }
      let pie_options = {};
      let pie_color_options = {};

      if (this.gcMode == "pie" || this.gcMode == "donut") {
        pie_options = {
          label: {
              format: function (value, ratio, id) {
                  return this.formatDecimal(value, 1) + " ha";
              }.bind(this)
          }
        };
        pie_color_options = {"area under crops": '#60B044', "uncultivated area": '#FF0000' };
      }
      console.debug(this.gcMode);

      this.chart = bb.generate({
        bindto: '#chart_'+this.gcWidgetId,
        // size: {
        //   width: this.chartWidth,  
        //   height: this.chartHeight
        // },
        data: {
          // CAUTION: for gauge / pie in billboard you will have to initialize it with data!
          columns: data,
          type: this.gcMode, 
          colors: pie_color_options,
          names: { //with i18n
            "uncultivated area": this.$t("legend.uncultivated_area"),
            "area under crops": this.$t("legend.area_under_crops"),
            "fraction under crops": this.$t("legend.fraction_under_crops"),
          },
        },
        pie: pie_options,
        color: color_options,
        transition: {
            duration: 500
        },
        legend: {
          hide: !this.availableOptions.includes('legend') ? ["area under crops", "uncultivated area", "fraction under crops"] : [],
          position: this.gcLegendPosition
        }
      });

      // toggles animation of chart
      this.chart.load({
        columns: data,
        done: function() {
          // hide spinner after data is loaded
          //setTimeout(function() {
          this.isloading = false;
          //}.bind(this), 2000
          //);
        }.bind(this)
      });

    },
    initDatePickers() {

      console.debug("initDatePickers()");
      if (this.inpSdatePicker) {
        this.inpSdatePicker.destroy();
      }

      this.inpSdatePicker = new bulmaCalendar( document.getElementById( 'inpSdate_'+this.gcWidgetId ), {
        startDate: new Date(Date.parse(this.selectedDate)), // Date selected by default
        dateFormat: 'yyyy-mm-dd', // the date format `field` value
        lang: this.currentLanguage, // internationalization
        overlay: false,
        align: "right",
        closeOnOverlayClick: true,
        closeOnSelect: true,
        // callback functions
        onSelect: function (e) { 
                    // hack +1 day - don't know why we need this here - timezone?
                    var a = new Date(e.valueOf() + 1000*3600*24);
                    this.selectedDate = a.toISOString().split("T")[0]; //ISO String splits at T between date and time
                    }.bind(this),
      });
    },
    /* GUI helper */
    changeLanguage() {
      this.$i18n.locale = this.currentLanguage;
    },  
    /* helper functions */
    removeFromArray: function(arry, value) {
      let index = arry.indexOf(value);
      if (index > -1) {
          arry.splice(index, 1);
      }
      return arry;
    },
    formatDecimal: function(decimal, numberOfDecimals) {
      /* Helper function for formatting numbers to given number of decimals */
  
      var factor = 100;
  
      if ( isNaN(parseFloat(decimal)) ) {
          return NaN;
      }
      if (numberOfDecimals == 1) {
          factor = 10;
      }
      if (numberOfDecimals == 2) {
          factor = 100;
      }
      if (numberOfDecimals == 3) {
          factor = 1000;
      }
      if (numberOfDecimals == 4) {
          factor = 10000;
      }
      if (numberOfDecimals == 5) {
          factor = 100000;
      }
      return Math.ceil(decimal * factor)/factor;
    },
    capitalize: function (s) {
      if (typeof s !== 'string') return ''
      return s.charAt(0).toUpperCase() + s.slice(1)
    },
    isDateValid: function (date_str) {
      /* Validates a given date string */
      if (!isNaN(new Date(date_str))) {
          return true;
      }
      else {
          return false;
      }
    },
    loadJSscript: function (url, callback) {
      
      let script = document.createElement("script");  // create a script DOM node
      script.src = gcGetBaseURL() + "/" + url;  // set its src to the provided URL
      script.async = true;
      console.debug(script.src);
      document.body.appendChild(script);  // add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
      script.onload = function () {
        callback();
      };
    },

    // showMsg : function (msg) {
    //   try { document.getElementById("sDate_"+this.gcWidgetId).classList.add("is-hidden"); } catch (ex) {}
    //   try { document.getElementById("desc_" + this.gcWidgetId).classList.add("is-hidden"); } catch (ex) {}

    //   if(msg === 'key is not authorized'){
    //     document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, the given API key is not authorized!<br> Please contact <a href='https://www.geocledian.com'>geo|cledian</a> for a valid API key.";
    //   }
    //   else if(msg === 'api key validity expired'){
    //     document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, the given API key's validity expired!<br> Please contact <a href='https://www.geocledian.com'>geo|cledian</a>for a valid API key.";
    //   } else{
    //     document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, an error occurred!<br>Please check the console log for more information.";
    //   }

    //   document.getElementById("chartNotice_" + this.gcWidgetId).classList.remove("is-hidden");
    //   document.getElementById("chartSpinner_" + this.gcWidgetId).classList.add("is-hidden");
    // },

  //  hideMsg : function () {
  //     try { document.getElementById("sDate_"+this.gcWidgetId).classList.remove("is-hidden"); } catch (ex) {}
  //     try { document.getElementById("desc_" + this.gcWidgetId).classList.remove("is-hidden"); } catch (ex) {}
  //     document.getElementById("chartNotice_"+this.gcWidgetId).classList.add("is-hidden");
  //     document.getElementById("chart_" + this.gcWidgetId).classList.remove("is-hidden");
  //     document.getElementById("chartSpinner_" + this.gcWidgetId).classList.remove("is-hidden");
  //   }
  },
  beforeDestroy: function () {
    window.removeEventListener('resize', this.triggerResize)
  }
});