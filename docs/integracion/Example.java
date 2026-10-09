// Java 17, no dependencies. Query an existing document; use JSON cases for POST requests.
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.nio.file.Files;
import java.nio.file.Path;
public class Example {
  public static void main(String[] args) throws Exception {
    String base = System.getenv().getOrDefault("FACTOSYS_URL", "http://localhost:3000").replaceAll("/$", "");
    String key = System.getenv("FACTOSYS_API_KEY");
    if (key == null) throw new IllegalArgumentException("Set FACTOSYS_API_KEY");
    HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
    HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(base + (args.length == 0 ? "/v1/capabilities" : args[0])))
      .timeout(Duration.ofSeconds(60)).header("Authorization", "Bearer " + key).header("Accept", "application/json");
    if (args.length > 1) {
      // args: /v1/invoices invoice.json persisted-idempotency-key; substitute company_id beforehand.
      if (args.length < 3) throw new IllegalArgumentException("Supply persisted idempotency key");
      request.header("Content-Type", "application/json").header("Idempotency-Key", args[2])
        .POST(HttpRequest.BodyPublishers.ofString(Files.readString(Path.of(args[1]))));
    } else request.GET();
    HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) throw new IllegalStateException("HTTP " + response.statusCode() + ": " + response.body());
    System.out.println(response.body());
    // A 201 response registers locally; poll /v1/documents/{id} for fiscal acceptance.
  }
}
