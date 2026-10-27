# Layered line and bar

A throughput chart, as `bl report` writes it.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "Throughput",
  "description": "Points reaching done per week, and the trailing four-week average.",
  "width": "container",
  "data": {
    "values": [
      {
        "series": "points done",
        "x": "2026-09-07",
        "y": 4,
        "order": 0
      },
      {
        "series": "points done",
        "x": "2026-09-14",
        "y": 4,
        "order": 0
      },
      {
        "series": "points done",
        "x": "2026-09-21",
        "y": 6,
        "order": 0
      },
      {
        "series": "points done",
        "x": "2026-09-28",
        "y": 6,
        "order": 0
      },
      {
        "series": "points done",
        "x": "2026-10-05",
        "y": 5,
        "order": 0
      },
      {
        "series": "4-week average",
        "x": "2026-09-07",
        "y": 4,
        "order": 1
      },
      {
        "series": "4-week average",
        "x": "2026-09-14",
        "y": 4,
        "order": 1
      },
      {
        "series": "4-week average",
        "x": "2026-09-21",
        "y": 4.7,
        "order": 1
      },
      {
        "series": "4-week average",
        "x": "2026-09-28",
        "y": 5,
        "order": 1
      },
      {
        "series": "4-week average",
        "x": "2026-10-05",
        "y": 5.25,
        "order": 1
      }
    ]
  },
  "layer": [
    {
      "transform": [
        {
          "filter": {
            "field": "series",
            "oneOf": [
              "points done"
            ]
          }
        }
      ],
      "mark": {
        "type": "bar"
      },
      "encoding": {
        "x": {
          "field": "x",
          "type": "temporal",
          "title": null,
          "scale": {
            "type": "utc"
          },
          "axis": {
            "format": "%b %Y",
            "tickCount": "month"
          },
          "timeUnit": "utcyearweek"
        },
        "y": {
          "field": "y",
          "type": "quantitative",
          "title": "Points",
          "scale": {
            "zero": true
          },
          "stack": null
        },
        "color": {
          "field": "series",
          "type": "nominal",
          "title": null,
          "scale": {
            "domain": [
              "points done",
              "4-week average"
            ],
            "range": [
              "#0072B2",
              "#E69F00"
            ]
          },
          "legend": {
            "orient": "bottom"
          }
        },
        "tooltip": [
          {
            "field": "series",
            "type": "nominal",
            "title": "Series"
          },
          {
            "field": "x",
            "type": "temporal",
            "timeUnit": "utcyearmonthdate",
            "title": "Week of",
            "format": "%Y-%m-%d"
          },
          {
            "field": "y",
            "type": "quantitative",
            "title": "Points"
          }
        ]
      }
    },
    {
      "transform": [
        {
          "filter": {
            "field": "series",
            "oneOf": [
              "4-week average"
            ]
          }
        }
      ],
      "mark": {
        "type": "line",
        "point": true
      },
      "encoding": {
        "x": {
          "field": "x",
          "type": "temporal",
          "title": null,
          "scale": {
            "type": "utc"
          },
          "axis": {
            "format": "%b %Y",
            "tickCount": "month"
          }
        },
        "y": {
          "field": "y",
          "type": "quantitative",
          "title": "Points",
          "scale": {
            "zero": true
          },
          "stack": null
        },
        "color": {
          "field": "series",
          "type": "nominal",
          "title": null,
          "scale": {
            "domain": [
              "points done",
              "4-week average"
            ],
            "range": [
              "#0072B2",
              "#E69F00"
            ]
          },
          "legend": {
            "orient": "bottom"
          }
        },
        "tooltip": [
          {
            "field": "series",
            "type": "nominal",
            "title": "Series"
          },
          {
            "field": "x",
            "type": "temporal",
            "timeUnit": "utcyearmonthdate",
            "title": "Week of",
            "format": "%Y-%m-%d"
          },
          {
            "field": "y",
            "type": "quantitative",
            "title": "Points"
          }
        ]
      }
    }
  ]
}
```

After the chart.
