# Stacked area

A cumulative flow diagram, as `bl report` writes it.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "Cumulative flow",
  "description": "Points by status per week, stacked.",
  "width": "container",
  "data": {
    "values": [
      {
        "series": "done",
        "x": "2026-09-07",
        "y": 10,
        "order": 0
      },
      {
        "series": "done",
        "x": "2026-09-14",
        "y": 14,
        "order": 0
      },
      {
        "series": "done",
        "x": "2026-09-21",
        "y": 20,
        "order": 0
      },
      {
        "series": "done",
        "x": "2026-09-28",
        "y": 26,
        "order": 0
      },
      {
        "series": "done",
        "x": "2026-10-05",
        "y": 31,
        "order": 0
      },
      {
        "series": "in progress",
        "x": "2026-09-07",
        "y": 3,
        "order": 1
      },
      {
        "series": "in progress",
        "x": "2026-09-14",
        "y": 5,
        "order": 1
      },
      {
        "series": "in progress",
        "x": "2026-09-21",
        "y": 2,
        "order": 1
      },
      {
        "series": "in progress",
        "x": "2026-09-28",
        "y": 4,
        "order": 1
      },
      {
        "series": "in progress",
        "x": "2026-10-05",
        "y": 3,
        "order": 1
      },
      {
        "series": "refined",
        "x": "2026-09-07",
        "y": 6,
        "order": 2
      },
      {
        "series": "refined",
        "x": "2026-09-14",
        "y": 4,
        "order": 2
      },
      {
        "series": "refined",
        "x": "2026-09-21",
        "y": 7,
        "order": 2
      },
      {
        "series": "refined",
        "x": "2026-09-28",
        "y": 5,
        "order": 2
      },
      {
        "series": "refined",
        "x": "2026-10-05",
        "y": 8,
        "order": 2
      },
      {
        "series": "backlog",
        "x": "2026-09-07",
        "y": 20,
        "order": 3
      },
      {
        "series": "backlog",
        "x": "2026-09-14",
        "y": 22,
        "order": 3
      },
      {
        "series": "backlog",
        "x": "2026-09-21",
        "y": 21,
        "order": 3
      },
      {
        "series": "backlog",
        "x": "2026-09-28",
        "y": 24,
        "order": 3
      },
      {
        "series": "backlog",
        "x": "2026-10-05",
        "y": 23,
        "order": 3
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
              "done",
              "in progress",
              "refined",
              "backlog"
            ]
          }
        }
      ],
      "mark": {
        "type": "area",
        "opacity": 0.85,
        "line": true
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
          "stack": "zero"
        },
        "color": {
          "field": "series",
          "type": "nominal",
          "title": null,
          "scale": {
            "domain": [
              "done",
              "in progress",
              "refined",
              "backlog"
            ],
            "range": [
              "#0072B2",
              "#E69F00",
              "#009E73",
              "#999999"
            ]
          },
          "legend": {
            "orient": "bottom"
          }
        },
        "order": {
          "field": "order",
          "type": "quantitative"
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
