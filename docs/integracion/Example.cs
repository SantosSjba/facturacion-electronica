// .NET 8 console example. Run with your sandbox variables and a cases/*.json path.
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
var baseUrl = (Environment.GetEnvironmentVariable("FACTOSYS_URL") ?? "http://localhost:3000").TrimEnd('/');
var apiKey = Environment.GetEnvironmentVariable("FACTOSYS_API_KEY") ?? throw new Exception("Set FACTOSYS_API_KEY");
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
async Task<JsonObject> Call(string method, string path, JsonObject? body = null, string? idem = null) {
    using var req = new HttpRequestMessage(new HttpMethod(method), baseUrl + path);
    if (body != null) req.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
    if (idem != null) req.Headers.Add("Idempotency-Key", idem);
    using var res = await http.SendAsync(req);
    var text = await res.Content.ReadAsStringAsync();
    if (!res.IsSuccessStatusCode) throw new Exception($"HTTP {(int)res.StatusCode}: {text}");
    return JsonNode.Parse(text)!.AsObject();
}
var input = JsonNode.Parse(await File.ReadAllTextAsync(args.Length > 0 ? args[0] : "cases/01-01-credito-cuotas.json"))!.AsObject();
input["company_id"] = Environment.GetEnvironmentVariable("FACTOSYS_COMPANY_ID") ?? input["company_id"]!.GetValue<string>();
var idemKey = Environment.GetEnvironmentVariable("FACTOSYS_IDEMPOTENCY_KEY") ?? throw new Exception("Persist FACTOSYS_IDEMPOTENCY_KEY before emission");
var doc = await Call("POST", "/v1/invoices", input, idemKey);
var terminal = new HashSet<string> { "accepted", "accepted_with_observation", "rejected", "failed", "cancelled" };
for (var i = 0; i < 30 && !terminal.Contains(doc["status"]!.GetValue<string>()); i++) {
    await Task.Delay(2000); doc = await Call("GET", "/v1/documents/" + Uri.EscapeDataString(doc["id"]!.GetValue<string>()));
}
Console.WriteLine(doc.ToJsonString());
